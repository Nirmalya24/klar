export type Lens = "omnis" | "opus" | "fiscus" | "vita" | "systema";
export type Bucket = "hodie" | "heri" | "olim";
export type Mailbox = "inbox" | "sent" | "trash";
export type MessageSource = "gmail" | "local";

export interface StreamItem {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  bucket: Bucket;
  lens: Exclude<Lens, "omnis">;
}

export interface ImportedMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  internalDate: string;
  bodyText: string;
  bodyHtml: string | null;
  source: MessageSource;
  mailbox: Mailbox;
  deletedAt: string | null;
  replyToMessageId: string | null;
  mirrorRequested: boolean;
  mirroredToGmail: boolean;
}

export interface MailSettings {
  mirrorActionsToGmail: boolean;
}
