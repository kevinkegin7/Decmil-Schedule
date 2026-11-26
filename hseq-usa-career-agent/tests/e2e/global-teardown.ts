import { deleteE2eUser } from "./test-user";

export default async function globalTeardown() {
  await deleteE2eUser();
}
