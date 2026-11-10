import "server-only";

/**
 * Operator (data controller) details shown on the legal pages.
 * Vietnamese law requires users to be told who processes their data and how to
 * reach them — set these in the environment before going live.
 */
export const operator = {
  name: process.env.OPERATOR_NAME || "[Tên tổ chức / cá nhân vận hành]",
  email: process.env.OPERATOR_EMAIL || "[email liên hệ]",
  address: process.env.OPERATOR_ADDRESS || "[địa chỉ liên hệ]",
  configured: Boolean(process.env.OPERATOR_NAME && process.env.OPERATOR_EMAIL),
};

/** Date the legal texts were last revised (shown on each page). */
export const LEGAL_UPDATED = "2026-11-10";
