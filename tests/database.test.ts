import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Postgres RLS, event ordering, and payment transactions", async (suite) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL("../supabase/migrations/202611170001_initial.sql", import.meta.url), "utf8"));
  const companyA = "10000000-0000-0000-0000-000000000001";
  const companyB = "10000000-0000-0000-0000-000000000002";
  const manager = "20000000-0000-0000-0000-000000000001";
  const cleaner = "20000000-0000-0000-0000-000000000002";
  const managerB = "20000000-0000-0000-0000-000000000003";
  const cleanerB = "20000000-0000-0000-0000-000000000004";
  const propertyA = "30000000-0000-0000-0000-000000000001";
  const propertyB = "30000000-0000-0000-0000-000000000002";
  await db.exec(`insert into auth.users values('${manager}'),('${cleaner}'),('${managerB}'),('${cleanerB}');
    insert into companies(id,name,timezone) values('${companyA}','A','UTC'),('${companyB}','B','UTC');
    insert into memberships values('${manager}','${companyA}','manager'),('${cleaner}','${companyA}','cleaner'),
      ('${managerB}','${companyB}','manager'),('${cleanerB}','${companyB}','cleaner');
    insert into properties(id,company_id,external_id,name,location) values
      ('${propertyA}','${companyA}','p1','A','A'),('${propertyB}','${companyB}','p1','B','B');`);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const event = (id: string, version: number, guest = "Guest") => ({ id, version, type: "reservation.updated", data: {
    id: "r1", property_id: "p1", guest_name: guest, check_in: today, check_out: tomorrow,
    status: "confirmed", email: "private@example.com", phone: "+15551234567",
  } });
  const ingest = async (company: string, payload: unknown) => (await db.query<{ result: string }>(
    "select ingest_pms($1,$2::jsonb) as result", [company, JSON.stringify(payload)])).rows[0].result;
  await ingest(companyA, event("new", 2));
  await ingest(companyB, event("new", 2));
  await suite.test("duplicate and older reservation events cannot overwrite", async () => {
    assert.equal(await ingest(companyA, event("new", 2)), "duplicate");
    const stale = event("old", 1, "Stale");
    stale.data.email = "stale@example.com";
    assert.equal(await ingest(companyA, stale), "stale");
    assert.equal(await ingest(companyA, event("new", 999, "Duplicate attack")), "duplicate");
    assert.equal((await db.query<{ guest_name: string }>("select guest_name from reservations where company_id=$1", [companyA])).rows[0].guest_name, "Guest");
    assert.equal((await db.query<{ email: string }>("select email from guest_contacts where company_id=$1", [companyA])).rows[0].email, "private@example.com");
  });
  const msg = { id: "m-event", version: 2, type: "message.updated", data: { id: "m1", property_id: "p1", reservation_id: "r1", body: "Wi-Fi?", sent_at: new Date().toISOString() } };
  await ingest(companyA, msg);
  await ingest(companyB, msg);
  await suite.test("message versions and missing dependencies", async () => {
    assert.equal(await ingest(companyA, { ...msg, id: "m-old", version: 1, data: { ...msg.data, body: "Stale body" } }), "stale");
    assert.equal((await db.query<{ body: string }>("select body from messages where company_id=$1", [companyA])).rows[0].body, "Wi-Fi?");
    await assert.rejects(ingest(companyA, { ...msg, id: "pending", data: { ...msg.data, reservation_id: "missing" } }));
    assert.equal((await db.query("select * from webhook_events where event_id='pending'")).rows.length, 0);
  });
  const asUser = async (id: string, run: () => Promise<void>) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
    try { await run(); } finally { await db.exec("reset role"); }
  };
  await suite.test("manager cannot read or mutate company B", async () => asUser(manager, async () => {
    for (const table of ["companies", "properties", "reservations", "messages", "guest_contacts"]) {
      const rows = (await db.query<Record<string, string>>(`select * from ${table}`)).rows;
      assert.equal(rows.length, 1, table);
      assert.equal(table === "companies" ? rows[0].id : rows[0].company_id, companyA);
    }
    await assert.rejects(db.exec("update reservations set guest_name='hacked'"));
    await assert.rejects(db.query("select ingest_pms($1,$2::jsonb)", [companyB, JSON.stringify(event("attack", 9))]));
  }));
  await suite.test("company B manager cannot read company A", async () => asUser(managerB, async () => {
    for (const table of ["properties", "reservations", "messages", "guest_contacts"]) {
      const rows = (await db.query<{ company_id: string }>(`select * from ${table}`)).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].company_id, companyB);
    }
  }));
  await db.exec(`insert into reservations(company_id,property_id,external_id,guest_name,check_in,check_out,status,source_version)
    values('${companyA}','${propertyA}','future','Future',current_date+10,current_date+12,'confirmed',1),
    ('${companyA}','${propertyA}','cancelled','Cancelled',current_date,current_date+2,'cancelled',1),
    ('${companyA}','${propertyA}','past','Past',current_date-10,current_date-8,'confirmed',1);`);
  await suite.test("cleaner only sees today's stays and no contact rows even with joins", async () => asUser(cleaner, async () => {
    assert.equal((await db.query("select * from reservations")).rows.length, 1);
    assert.equal((await db.query("select * from guest_contacts")).rows.length, 0);
    assert.equal((await db.query("select * from messages")).rows.length, 0);
    const joined = (await db.query<{ email: string | null; phone: string | null }>("select email,phone from reservations left join guest_contacts on reservations.id=guest_contacts.reservation_id")).rows;
    assert.equal(joined.length, 1);
    assert.equal(joined[0].email, null);
    assert.equal(joined[0].phone, null);
    await assert.rejects(db.exec("select * from guest_links"));
    await assert.rejects(db.exec("update memberships set role='manager'"));
    await assert.rejects(db.exec("select confirm_payment(gen_random_uuid(),'x','x',4000,'usd')"));
  }));
  await suite.test("company B cleaner also cannot see guest contacts", async () => asUser(cleanerB, async () => {
    const rows = (await db.query<{ company_id: string }>("select * from reservations")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].company_id, companyB);
    assert.equal((await db.query("select * from guest_contacts")).rows.length, 0);
  }));
  await suite.test("anonymous users see no tenant rows", async () => {
    await db.exec("set role anon");
    try { await assert.rejects(db.exec("select * from reservations")); } finally { await db.exec("reset role"); }
  });
  await suite.test("payment requires bound session and repeats apply once", async () => {
    const reservation = (await db.query<{ id: string }>("select id from reservations where company_id=$1 and external_id='r1'", [companyA])).rows[0].id;
    await db.query("insert into guest_links(token_hash,reservation_id,expires_at,checkout_session_id) values('hash',$1,now()+interval '1 day','cs_test_1')", [reservation]);
    const first = (await db.query<{ result: string }>("select claim_checkout($1)::text result", [reservation])).rows[0].result;
    assert.equal((await db.query<{ result: string }>("select claim_checkout($1)::text result", [reservation])).rows[0].result, first);
    await assert.rejects(db.query("select confirm_payment($1,'wrong','evt0',4000,'usd')", [reservation]));
    await assert.rejects(db.query("select confirm_payment($1,'cs_test_1','evt0',100,'usd')", [reservation]));
    assert.equal((await db.query<{ result: boolean }>("select confirm_payment($1,'cs_test_1','evt1',4000,'usd') result", [reservation])).rows[0].result, true);
    assert.equal((await db.query<{ result: boolean }>("select confirm_payment($1,'cs_test_1','evt1',4000,'usd') result", [reservation])).rows[0].result, false);
    assert.equal((await db.query("select * from payments")).rows.length, 1);
    assert.equal((await db.query<{ early_check_in_paid: boolean }>("select early_check_in_paid from reservations where id=$1", [reservation])).rows[0].early_check_in_paid, true);
  });
  await db.close();
});