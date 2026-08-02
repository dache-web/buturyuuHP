const getBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_GAS_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_GAS_API_URL is not defined in environment variables.");
  }
  return url;
};

export const getSettingsUrl = (): string => {
  return `${getBaseUrl()}?action=settings`;
};

export const getRulesUrl = (): string => {
  return `${getBaseUrl()}?action=rules`;
};

export const getFieldsUrl = (ruleId: string): string => {
  if (!ruleId) throw new Error("ruleId is required");
  return `${getBaseUrl()}?action=fields&ruleId=${encodeURIComponent(ruleId)}`;
};

export const getOutputSettingsUrl = (ruleId: string): string => {
  if (!ruleId) throw new Error("ruleId is required");
  return `${getBaseUrl()}?action=output-settings&ruleId=${encodeURIComponent(ruleId)}`;
};

export const getChoicesUrl = (type: string): string => {
  if (!type) throw new Error("type is required");
  return `${getBaseUrl()}?action=choices&type=${encodeURIComponent(type)}`;
};
