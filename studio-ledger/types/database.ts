export type Gender = "male" | "female" | "other";
export type MemberStatus = "active" | "paused" | "inactive";
export type StaffRole = "owner" | "staff";
export type BusinessType = "yoga_studio" | "gym" | "barbershop" | "salon" | "other";

export interface Studio {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
  timezone: string;
  subscription_status: string;
  business_type: BusinessType;
  reminder_days: number;
  reminder_message: string | null;
  public_intake_enabled: boolean;
  public_intake_slug: string | null;
  created_at: string;
}

export interface StaffUser {
  id: string;
  studio_id: string;
  email: string;
  role: StaffRole;
  created_at: string;
}

export interface Member {
  id: string;
  studio_id: string;
  name: string;
  gender: Gender | null;
  phone: string | null;
  email: string | null;
  joined_on: string; // YYYY-MM-DD
  monthly_fee: number;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  studio_id: string;
  member_id: string;
  month: string; // YYYY-MM
  amount: number | null;
  paid: boolean;
  paid_on: string | null; // YYYY-MM-DD
  created_at: string;
}

export interface Visit {
  id: string;
  studio_id: string;
  member_id: string;
  visited_on: string; // YYYY-MM-DD
  service: string | null;
  amount: number | null;
  notes: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      studios: {
        Row: Studio;
        Insert: Partial<Studio> & { name: string };
        Update: Partial<Studio>;
        Relationships: [];
      };
      staff_users: {
        Row: StaffUser;
        Insert: Partial<StaffUser> & { id: string; studio_id: string; email: string };
        Update: Partial<StaffUser>;
        Relationships: [];
      };
      members: {
        Row: Member;
        Insert: Partial<Member> & { studio_id: string; name: string };
        Update: Partial<Member>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment> & { member_id: string; month: string };
        Update: Partial<Payment>;
        Relationships: [];
      };
      visits: {
        Row: Visit;
        Insert: Partial<Visit> & { member_id: string };
        Update: Partial<Visit>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      create_studio: {
        Args: { studio_name: string; business_type?: BusinessType };
        Returns: Studio;
      };
      get_intake_studio: {
        Args: { intake_slug: string };
        Returns: { name: string; business_type: BusinessType }[];
      };
      public_intake_add_client: {
        Args: {
          intake_slug: string;
          client_name: string;
          client_phone?: string | null;
          client_email?: string | null;
        };
        Returns: Member;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};
