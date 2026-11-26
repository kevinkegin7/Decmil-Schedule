import { admin, deleteE2eUser, E2E_EMAIL, E2E_PASSWORD } from "./test-user";

/** Fresh, empty test account for every run. */
export default async function globalSetup() {
  await deleteE2eUser();
  const { error } = await admin().auth.admin.createUser({ email: E2E_EMAIL, password: E2E_PASSWORD, email_confirm: true });
  if (error) throw error;
}
