import { generateMobileToken } from "../src/lib/mobile-auth";
import { prisma } from "../src/lib/prisma";

const email = process.argv[2];
if (!email) throw new Error("pass email as argv");
(async () => {
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, username: true } });
  if (!u) throw new Error("user not found: " + email);
  const token = await generateMobileToken(u.id);
  console.log(JSON.stringify({ userId: u.id, username: u.username, token }));
})().catch(e => { console.error(e); process.exit(1); });
