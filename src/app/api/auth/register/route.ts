import { prisma } from "@/lib/prisma";
import bcryptjs from "bcryptjs";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "This email is already registered" }, { status: 400 });
  }

  const hashed = await bcryptjs.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
  });

  return Response.json({ id: user.id, name: user.name, email: user.email });
}
