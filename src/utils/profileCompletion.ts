export interface ProfileRequirementsInput {
  full_name?: string | null;
  phone?: string | null;
  home_address?: string | null;
  current_address?: string | null;
  social_links?: unknown;
}

export function getProfileRequirementStatus(profile: ProfileRequirementsInput) {
  const name = profile.full_name?.trim() || "";
  const legalNameValid =
    name.length >= 2 &&
    !/\d/.test(name) &&
    /^[\p{L}\p{M}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'’.-]*)*$/u.test(name);
  const phoneDigits = (profile.phone || "").replace(/\D/g, "");
  const phoneValid = /^[+()\d\s.-]+$/.test(profile.phone?.trim() || "") && phoneDigits.length >= 7 && phoneDigits.length <= 15;
  const addressValid = [profile.home_address, profile.current_address].some((address) => (address?.trim().length || 0) >= 5);
  const socialLinks = profile.social_links && typeof profile.social_links === "object" && !Array.isArray(profile.social_links)
    ? profile.social_links as Record<string, unknown>
    : {};
  const socialValid = Boolean(
    (typeof socialLinks.instagram === "string" && socialLinks.instagram.trim()) ||
    (typeof socialLinks.facebook === "string" && socialLinks.facebook.trim()),
  );

  const items = [
    { key: "name", label: "Legal full name", complete: legalNameValid },
    { key: "phone", label: "Mobile number", complete: phoneValid },
    { key: "address", label: "Home or current address", complete: addressValid },
    { key: "social", label: "Instagram or Facebook", complete: socialValid },
  ];

  const completed = items.filter((item) => item.complete).length;
  return {
    items,
    completed,
    total: items.length,
    percentage: Math.round((completed / items.length) * 100),
    isComplete: completed === items.length,
  };
}
