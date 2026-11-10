import type { Metadata } from "next";
import { getWorkspace, listChannels, listChatMessages, memberNames } from "@/lib/data";
import { ChatRoom } from "./room";

export const metadata: Metadata = { title: "Team chat" };

export default async function ChatPage(props: PageProps<"/chat">) {
  const params = await props.searchParams;
  const ws = await getWorkspace();
  const channels = await listChannels(ws.account.id);
  const current = channels.find((c) => c.name === params.c) ?? channels[0];
  const names = await memberNames(ws.account.id);
  const messages = current ? await listChatMessages(ws.account.id, current.id, names) : [];

  return (
    <ChatRoom
      key={current?.id}
      accountId={ws.account.id}
      channels={channels}
      current={current}
      initial={messages}
      names={names}
      me={{ id: ws.userId, name: ws.fullName ?? ws.firstName }}
    />
  );
}
