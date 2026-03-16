export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: "driver" | "host" | "admin";
          phone: string | null;
          avatar_url: string | null;
          preferred_reserve_percent: number;
          stripe_account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          role?: "driver" | "host" | "admin";
          phone?: string | null;
          avatar_url?: string | null;
          preferred_reserve_percent?: number;
          stripe_account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          role?: "driver" | "host" | "admin";
          phone?: string | null;
          avatar_url?: string | null;
          preferred_reserve_percent?: number;
          stripe_account_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      chargers: {
        Row: {
          id: string;
          host_id: string;
          name: string;
          address: string;
          suburb: string;
          state: string;
          latitude: number;
          longitude: number;
          max_power_kw: number;
          price_per_kwh: number;
          connectors: Json;
          amenities: string[];
          availability_note: string;
          availability_window: Json | null;
          images: string[];
          status: "pending" | "approved" | "rejected";
          verification_score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          name: string;
          address: string;
          suburb: string;
          state: string;
          latitude: number;
          longitude: number;
          max_power_kw: number;
          price_per_kwh: number;
          connectors?: Json;
          amenities?: string[];
          availability_note?: string;
          availability_window?: Json | null;
          images?: string[];
          status?: "pending" | "approved" | "rejected";
          verification_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          host_id?: string;
          name?: string;
          address?: string;
          suburb?: string;
          state?: string;
          latitude?: number;
          longitude?: number;
          max_power_kw?: number;
          price_per_kwh?: number;
          connectors?: Json;
          amenities?: string[];
          availability_note?: string;
          availability_window?: Json | null;
          images?: string[];
          status?: "pending" | "approved" | "rejected";
          verification_score?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          charger_id: string;
          driver_id: string;
          host_id: string;
          start_time: string;
          end_time: string;
          estimated_kwh: number;
          total_amount: number;
          platform_fee: number;
          note: string;
          status: "requested" | "approved" | "declined" | "in_progress" | "completed" | "cancelled";
          arrival_signal: "en_route" | "arrived" | "charging" | "departed";
          expires_at: string | null;
          stripe_payment_intent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          charger_id: string;
          driver_id: string;
          host_id: string;
          start_time: string;
          end_time: string;
          estimated_kwh: number;
          total_amount?: number;
          platform_fee?: number;
          note?: string;
          status?: "requested" | "approved" | "declined" | "in_progress" | "completed" | "cancelled";
          arrival_signal?: "en_route" | "arrived" | "charging" | "departed";
          expires_at?: string | null;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          charger_id?: string;
          driver_id?: string;
          host_id?: string;
          start_time?: string;
          end_time?: string;
          estimated_kwh?: number;
          total_amount?: number;
          platform_fee?: number;
          note?: string;
          status?: "requested" | "approved" | "declined" | "in_progress" | "completed" | "cancelled";
          arrival_signal?: "en_route" | "arrived" | "charging" | "departed";
          expires_at?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          charger_id: string;
          driver_id: string;
          host_id: string;
          rating: number;
          comment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          charger_id: string;
          driver_id: string;
          host_id: string;
          rating: number;
          comment?: string;
          created_at?: string;
        };
        Update: {
          rating?: number;
          comment?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          make: string;
          model: string;
          year: number;
          battery_capacity_kwh: number;
          max_range_km: number;
          efficiency_kwh_per_100km: number;
          default_reserve_percent: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          make: string;
          model: string;
          year: number;
          battery_capacity_kwh: number;
          max_range_km: number;
          efficiency_kwh_per_100km: number;
          default_reserve_percent?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          make?: string;
          model?: string;
          year?: number;
          battery_capacity_kwh?: number;
          max_range_km?: number;
          efficiency_kwh_per_100km?: number;
          default_reserve_percent?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          origin: Json;
          destination: Json;
          current_battery_percent: number;
          vehicle_max_range_km: number;
          distance_km: number;
          duration_minutes: number;
          route_polyline: string;
          projected_arrival_percent: number;
          recommended_charger_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          origin: Json;
          destination: Json;
          current_battery_percent: number;
          vehicle_max_range_km: number;
          distance_km: number;
          duration_minutes: number;
          route_polyline: string;
          projected_arrival_percent: number;
          recommended_charger_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          origin?: Json;
          destination?: Json;
          current_battery_percent?: number;
          vehicle_max_range_km?: number;
          distance_km?: number;
          duration_minutes?: number;
          route_polyline?: string;
          projected_arrival_percent?: number;
          recommended_charger_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: "booking" | "verification" | "trip" | "system";
          is_read: boolean;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          type: "booking" | "verification" | "trip" | "system";
          is_read?: boolean;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
        Relationships: [];
      };
      verification_requests: {
        Row: {
          id: string;
          charger_id: string;
          host_id: string;
          status: "pending" | "approved" | "rejected" | "suspended";
          note: string;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          charger_id: string;
          host_id: string;
          status?: "pending" | "approved" | "rejected" | "suspended";
          note?: string;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "approved" | "rejected" | "suspended";
          note?: string;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
