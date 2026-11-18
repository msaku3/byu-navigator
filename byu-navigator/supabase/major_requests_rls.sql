-- Protect the existing major_requests table and let students manage only
-- requests associated with their signed-in student profile.
alter table public.major_requests enable row level security;

revoke all on public.major_requests from anon, public;
grant select, insert, delete on public.major_requests to authenticated;

drop policy if exists "Students read their own major requests" on public.major_requests;
create policy "Students read their own major requests"
  on public.major_requests for select to authenticated
  using (
    exists (
      select 1
      from public.student as s
      where s.netid = major_requests.student_netid
        and s.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Students submit their own major requests" on public.major_requests;
create policy "Students submit their own major requests"
  on public.major_requests for insert to authenticated
  with check (
    status = 'pending'
    and exists (
      select 1
      from public.student as s
      where s.netid = major_requests.student_netid
        and s.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Students cancel their own pending major requests" on public.major_requests;
create policy "Students cancel their own pending major requests"
  on public.major_requests for delete to authenticated
  using (
    status = 'pending'
    and exists (
      select 1
      from public.student as s
      where s.netid = major_requests.student_netid
        and s.auth_user_id = (select auth.uid())
    )
  );
