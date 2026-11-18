insert into public.companies(id,name,timezone) values
('10000000-0000-0000-0000-000000000001','Juniper Stays','America/Los_Angeles'),
('10000000-0000-0000-0000-000000000002','Shore & Stay','America/Los_Angeles');
insert into public.properties(id,company_id,external_id,name,location,image_url,facts) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','juniper-house','Juniper House','Joshua Tree, California',
'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=85',
'{"check_in":"Check-in starts at 3:00 PM.","wifi":"Wi-Fi network: Juniper Guest. Password: stay-curious-24.","parking":"One parking space is available in the driveway.","house_rules":"No smoking or parties. Quiet hours are 10 PM to 8 AM. No pets."}'),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','casa-sol','Casa Sol','Palm Springs, California',
'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=85',
'{"check_in":"Check-in starts at 4:00 PM.","wifi":"Wi-Fi network: Casa Sol. Password: sunny-days-26.","parking":"Two parking spaces are available in the garage.","house_rules":"No smoking. Quiet hours start at 9 PM. No pets."}'),
('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','mesa-loft','The Mesa Loft','Yucca Valley, California',
'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=85',
'{"check_in":"Check-in starts at 3:00 PM.","wifi":"Wi-Fi network: Mesa Loft. Password: desert-light-26.","parking":"Use the marked space beside the entrance.","house_rules":"No pets, smoking, or parties. Quiet hours are 10 PM to 7 AM."}'),
('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','tide-house','The Tide House','Carmel, California',
'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=85',
'{"check_in":"Check-in starts at 4:00 PM.","wifi":"Wi-Fi network: Tide House. Password: ocean-air-26.","parking":"One parking space is available beside the house.","house_rules":"No smoking, pets, or parties. Quiet hours are 9 PM to 8 AM."}');
insert into public.reservations(id,company_id,property_id,external_id,guest_name,check_in,check_out,status,source_version) values
('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','booking-001','Emma Thompson',current_date,current_date+3,'confirmed',1),
('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','booking-002','James Miller',current_date,current_date+4,'confirmed',1),
('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','booking-003','Sophie Anderson',current_date,current_date+2,'confirmed',1),
('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004','booking-001','Alex Chen',current_date,current_date+3,'confirmed',1),
('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','booking-future','Future Guest',current_date+10,current_date+13,'confirmed',1);
insert into public.guest_contacts(reservation_id,company_id,email,phone)
select id,company_id,'guest-' || external_id || '@example.com','+15555550100' from public.reservations;
insert into public.messages(company_id,property_id,reservation_id,external_id,body,sent_at,source_version)
select company_id,property_id,id,'message-' || external_id,
case external_id when 'booking-002' then 'Would it be possible to check in early? We arrive around noon.' when 'booking-003' then 'What are the parking details?' else 'Hi! What is the Wi-Fi password?' end,
now()-interval '4 minutes',1 from public.reservations where external_id <> 'booking-future';