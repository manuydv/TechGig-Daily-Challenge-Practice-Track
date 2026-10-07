export type Gender = "male" | "female" | "other";
export type MemberStatus = "active" | "paused" | "inactive";
export type StaffRole = "owner" | "staff";
export type BusinessType = "yoga_studio" | "gym" | "barbershop" | "salon" | "other";
export type EmployeeStatus = "active" | "inactive";
export type ExpenseCategory = "rent" | "cleaning" | "utilities" | "supplies" | "payroll" | "other";

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
  public_checkin_enabled: boolean;
  contact_phone_1: string | null;
  contact_phone_2: string | null;
  contact_email: string | null;
  contact_address: string | null;
  website_url: string | null;
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
  check_in_pin: string | null;
  class_id: string | null;
  photo_url: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
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

export interface Employee {
  id: string;
  studio_id: string;
  name: string;
  role_title: string | null;
  phone: string | null;
  email: string | null;
  monthly_pay: number;
  status: EmployeeStatus;
  joined_on: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  studio_id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  expense_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  studio_id: string;
  name: string;
  instructor_name: string | null;
  days_of_week: number[]; // 0 = Sunday .. 6 = Saturday
  start_time: string; // HH:MM:SS
  duration_minutes: number;
  created_at: string;
  updated_at: string;
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
      employees: {
        Row: Employee;
        Insert: Partial<Employee> & { studio_id: string; name: string };
        Update: Partial<Employee>;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: Partial<Expense> & { studio_id: string; amount: number };
        Update: Partial<Expense>;
        Relationships: [];
      };
      classes: {
        Row: Class;
        Insert: Partial<Class> & { studio_id: string; name: string; start_time: string };
        Update: Partial<Class>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      create_studio: {
        Args: { studio_name: string; business_type?: BusinessType };
        Returns: Studio;
      };
      sync_member_statuses: {
        Args: Record<string, never>;
        Returns: void;
      };
      get_intake_studio: {
        Args: { intake_slug: string };
        Returns: {
          name: string;
          business_type: BusinessType;
          contact_phone_1: string | null;
          contact_phone_2: string | null;
          contact_email: string | null;
          contact_address: string | null;
          website_url: string | null;
        }[];
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
      get_checkin_studio: {
        Args: { intake_slug: string };
        Returns: {
          name: string;
          business_type: BusinessType;
          contact_phone_1: string | null;
          contact_phone_2: string | null;
          contact_email: string | null;
          contact_address: string | null;
          website_url: string | null;
        }[];
      };
      get_checkin_schedule: {
        Args: { intake_slug: string };
        Returns: {
          name: string;
          instructor_name: string | null;
          days_of_week: number[];
          start_time: string;
          duration_minutes: number;
        }[];
      };
      public_claim_checkin_pin: {
        Args: { intake_slug: string; client_phone: string; new_pin: string };
        Returns: void;
      };
      public_check_in: {
        Args: { intake_slug: string; client_phone: string; pin: string };
        Returns: {
          member_id: string;
          member_name: string;
          visited_on: string;
          recent_visits: string[];
          monthly_fee: number;
          member_status: MemberStatus;
          this_month_paid: boolean;
          photo_url: string | null;
          batch_name: string | null;
          batch_instructor_name: string | null;
          batch_days_of_week: number[] | null;
          batch_start_time: string | null;
          batch_duration_minutes: number | null;
          phone: string | null;
          email: string | null;
          date_of_birth: string | null;
        }[];
      };
      public_update_profile: {
        Args: {
          intake_slug: string;
          client_phone: string;
          pin: string;
          new_phone: string;
          new_email?: string | null;
          new_date_of_birth?: string | null;
          new_photo_url?: string | null;
        };
        Returns: {
          member_id: string;
          phone: string;
          email: string | null;
          date_of_birth: string | null;
          photo_url: string | null;
        }[];
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};
