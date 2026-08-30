export type Gender = "male" | "female" | "other";
export type MemberStatus = "active" | "paused" | "inactive";
export type StaffRole = "owner" | "staff";

export interface Studio {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
  timezone: string;
  subscription_status: string;
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
    };
    Views: {};
    Functions: {
      create_studio: {
        Args: { studio_name: string };
        Returns: Studio;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};
