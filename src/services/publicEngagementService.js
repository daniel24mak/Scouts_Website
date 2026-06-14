import {
  deleteSupabaseRows,
  getCurrentSupabaseUserId,
  getSupabaseRows,
  insertSupabaseRow,
  patchSupabaseRows
} from "./supabaseClient.js";

export const defaultFaqs = [
  {
    id: "default-age",
    question: "What age can children join the scouts?",
    answer: "Children and youth are grouped by the current scout year rules. Contact us with your child's age or grade and we will guide you to the right group.",
    displayOrder: 1,
    isActive: true
  },
  {
    id: "default-experience",
    question: "Do we need prior scouting experience?",
    answer: "No. New scouts are welcome, and chiefs help every member learn the basics through weekly meetings and activities.",
    displayOrder: 2,
    isActive: true
  },
  {
    id: "default-meetings",
    question: "When are the scout meetings?",
    answer: "Meeting dates and public events are shared on the calendar. Logged-in chiefs can also see group-only meeting plans.",
    displayOrder: 3,
    isActive: true
  },
  {
    id: "default-register",
    question: "How can I register my child?",
    answer: "Registration is usually opened at the beginning of the scout year through a form shared by the group.",
    displayOrder: 4,
    isActive: true
  },
  {
    id: "default-volunteer",
    question: "How can I become a scout leader or volunteer?",
    answer: "Send us a message through the contact form and our team will follow up with the next steps.",
    displayOrder: 5,
    isActive: true
  }
];

function normalizeFaq(row) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    displayOrder: Number(row.display_order ?? row.displayOrder ?? 0),
    isActive: row.is_active ?? row.isActive ?? true,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    updatedBy: row.updated_by ?? row.updatedBy ?? null
  };
}

function normalizeContactMessage(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status ?? "new",
    notes: row.notes ?? "",
    createdAt: row.created_at ?? row.createdAt ?? null,
    readAt: row.read_at ?? row.readAt ?? null,
    respondedAt: row.responded_at ?? row.respondedAt ?? null
  };
}


export async function getPublicFaqs() {
  const rows = await getSupabaseRows("faqs", "select=id,question,answer,display_order,is_active,created_at,updated_at&is_active=eq.true&order=display_order.asc,created_at.asc").catch(() => []);
  return rows.map(normalizeFaq).filter((faq) => faq.isActive !== false);
}

export async function getPublicEngagementData() {
  const [faqRows, messageRows] = await Promise.all([
    getSupabaseRows("faqs", "select=*&order=display_order.asc,created_at.asc").catch(() => []),
    getSupabaseRows("contact_messages", "select=*&order=created_at.desc").catch(() => [])
  ]);
  const faqs = faqRows.map(normalizeFaq);

  return {
    faqs: faqs.length ? faqs : defaultFaqs,
    contactMessages: messageRows.map(normalizeContactMessage)
  };
}

export function createFaq(faq) {
  return insertSupabaseRow("faqs", {
    question: faq.question,
    answer: faq.answer,
    display_order: Number(faq.displayOrder ?? 0),
    is_active: faq.isActive !== false,
    updated_by: getCurrentSupabaseUserId()
  });
}

export function updateFaq(faqId, faq) {
  return patchSupabaseRows("faqs", `id=eq.${encodeURIComponent(faqId)}`, {
    question: faq.question,
    answer: faq.answer,
    display_order: Number(faq.displayOrder ?? 0),
    is_active: faq.isActive !== false,
    updated_by: getCurrentSupabaseUserId(),
    updated_at: new Date().toISOString()
  });
}

export function deactivateFaq(faqId) {
  return patchSupabaseRows("faqs", `id=eq.${encodeURIComponent(faqId)}`, {
    is_active: false,
    updated_by: getCurrentSupabaseUserId(),
    updated_at: new Date().toISOString()
  });
}

export function deleteFaq(faqId) {
  return deleteSupabaseRows("faqs", `id=eq.${encodeURIComponent(faqId)}`);
}

export function submitContactMessage(message) {
  return insertSupabaseRow("contact_messages", {
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    status: "new"
  });
}

export function updateContactMessage(messageId, message) {
  const now = new Date().toISOString();
  const statusPatch = {
    status: message.status,
    notes: message.notes ?? "",
    read_at: message.status === "read" && !message.readAt ? now : message.readAt ?? null,
    responded_at: message.status === "responded" && !message.respondedAt ? now : message.respondedAt ?? null
  };

  return patchSupabaseRows("contact_messages", `id=eq.${encodeURIComponent(messageId)}`, statusPatch);
}

export function deleteContactMessage(messageId) {
  return deleteSupabaseRows("contact_messages", `id=eq.${encodeURIComponent(messageId)}`);
}
