import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { listAllSessions } from "@/lib/supabase/queries/translations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminUsersPage() {
  await requireAdmin();
  const sessions = await listAllSessions(200, 0);
  const supabase = await createSupabaseServerClient();
  const { data: authUsers } = await supabase.auth.admin.listUsers();

  return (
    <div>
      <h2>User Authentication</h2>
      <p className="panel-note">
        Public authentication has been removed. Only administrators have accounts.
      </p>

      <h3 style={{ marginTop: 24 }}>Admin Accounts ({authUsers?.users?.length ?? 0})</h3>
      {authUsers?.users?.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Last Sign In</th>
              </tr>
            </thead>
            <tbody>
              {authUsers.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email ?? "(no email)"}</td>
                  <td>
                    <span className="role-pill role-admin">
                      {u.app_metadata?.role === "admin" ? "admin" : "user"}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleString()}</td>
                  <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="panel-note">No admin accounts found.</p>
      )}

      <h3 style={{ marginTop: 24 }}>Sessions ({sessions.total})</h3>
      <p className="panel-note">
        Anonymous sessions are tracked without user accounts.
      </p>
    </div>
  );
}
