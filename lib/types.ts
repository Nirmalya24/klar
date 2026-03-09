export type Lens = "omnis" | "opus" | "fiscus" | "vita" | "systema";

export interface StreamItem {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  bucket: "hodie" | "heri" | "olim";
  lens: Exclude<Lens, "omnis">;
}
