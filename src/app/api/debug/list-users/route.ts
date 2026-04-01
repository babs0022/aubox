import { NextResponse } from "next/server";
import { TableClient } from "@azure/data-tables";
import { getUserFromSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";

export async function GET() {
  try {
    const actor = await getUserFromSession();
    if (!actor?.email || !isAdminEmail(actor.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      return NextResponse.json({ error: "Connection string not configured" }, { status: 500 });
    }

    const client = TableClient.fromConnectionString(connectionString, "auboxusers");
    const users: Record<string, unknown>[] = [];

    for await (const user of client.listEntities()) {
      users.push({
        id: user.rowKey,
        email: user.email,
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    }

    return NextResponse.json({ count: users.length, users });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
