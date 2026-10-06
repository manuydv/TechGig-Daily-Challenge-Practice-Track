import type { BusinessType } from "@/types/database";

export type TrackingMode = "membership" | "visit";

export interface BusinessTypeConfig {
  value: BusinessType;
  label: string;
  mode: TrackingMode;
  personLabelSingular: string;
  personLabelPlural: string;
}

export const BUSINESS_TYPES: BusinessTypeConfig[] = [
  {
    value: "yoga_studio",
    label: "Yoga / Fitness Studio",
    mode: "membership",
    personLabelSingular: "Member",
    personLabelPlural: "Members",
  },
  {
    value: "gym",
    label: "Gym",
    mode: "membership",
    personLabelSingular: "Member",
    personLabelPlural: "Members",
  },
  {
    value: "barbershop",
    label: "Barbershop",
    mode: "visit",
    personLabelSingular: "Client",
    personLabelPlural: "Clients",
  },
  {
    value: "salon",
    label: "Salon",
    mode: "visit",
    personLabelSingular: "Client",
    personLabelPlural: "Clients",
  },
  {
    value: "other",
    label: "Other",
    mode: "membership",
    personLabelSingular: "Member",
    personLabelPlural: "Members",
  },
];

export function getBusinessTypeConfig(businessType: BusinessType): BusinessTypeConfig {
  return BUSINESS_TYPES.find((t) => t.value === businessType) ?? BUSINESS_TYPES[0];
}
