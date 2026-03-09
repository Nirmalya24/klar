import { StreamItem } from "@/lib/types";

export const streamItems: StreamItem[] = [
  {
    id: "1",
    sender: "Ari Tanaka",
    subject: "Q4 logistics checkpoints",
    preview: "Need a decision on milestone dates before noon.",
    time: "09:12",
    bucket: "hodie",
    lens: "opus"
  },
  {
    id: "2",
    sender: "North Bank",
    subject: "Invoice 2881 received",
    preview: "Payment settles Thursday; please verify tax ID.",
    time: "08:03",
    bucket: "hodie",
    lens: "fiscus"
  },
  {
    id: "3",
    sender: "Mina",
    subject: "Dinner this Friday",
    preview: "Can we keep the reservation at 7:30?",
    time: "Yesterday",
    bucket: "heri",
    lens: "vita"
  },
  {
    id: "4",
    sender: "Klar System",
    subject: "2FA device added",
    preview: "New sign-in from Kyoto. Review if this was you.",
    time: "Yesterday",
    bucket: "heri",
    lens: "systema"
  },
  {
    id: "5",
    sender: "Studio Kumo",
    subject: "Brand review notes",
    preview: "Attached visual direction summary for April handoff.",
    time: "Mon",
    bucket: "olim",
    lens: "opus"
  }
];

export const bucketLabels = {
  hodie: "Hodie",
  heri: "Heri",
  olim: "Olim"
} as const;
