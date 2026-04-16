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
          is_driver: boolean;
          is_host: boolean;
          is_admin: boolean;
          is_suspended: boolean;
          phone: string | null;
          avatar_url: string | null;
          preferred_reserve_percent: number;
          stripe_account_id: string | null;
          stripe_customer_id: string | null;
          expo_push_token: string | null;
          avg_response_minutes: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          role?: "driver" | "host" | "admin";
          is_driver?: boolean;
          is_host?: boolean;
          is_admin?: boolean;
          is_suspended?: boolean;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_reserve_percent?: number;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          expo_push_token?: string | null;
          avg_response_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          role?: "driver" | "host" | "admin";
          is_driver?: boolean;
          is_host?: boolean;
          is_admin?: boolean;
          is_suspended?: boolean;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_reserve_percent?: number;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          expo_push_token?: string | null;
          avg_response_minutes?: number | null;
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
          rubric_photos: number | null;
          rubric_specs: number | null;
          rubric_location: number | null;
          rubric_access: number | null;
          rubric_pricing: number | null;
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
          rubric_photos?: number | null;
          rubric_specs?: number | null;
          rubric_location?: number | null;
          rubric_access?: number | null;
          rubric_pricing?: number | null;
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
          rubric_photos?: number | null;
          rubric_specs?: number | null;
          rubric_location?: number | null;
          rubric_access?: number | null;
          rubric_pricing?: number | null;
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
          actual_kwh: number | null;
          subtotal_amount: number | null;
          total_amount: number;
          platform_fee: number;
          actual_amount: number | null;
          host_payout_amount: number | null;
          note: string;
          status: "requested" | "approved" | "declined" | "active" | "completed" | "cancelled" | "expired" | "missed";
          arrival_signal: "en_route" | "arrived" | "charging" | "departed" | null;
          expires_at: string | null;
          grace_expires_at: string | null;
          session_started_at: string | null;
          session_ended_at: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          payment_status: string | null;
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
          actual_kwh?: number | null;
          subtotal_amount?: number | null;
          total_amount?: number;
          platform_fee?: number;
          actual_amount?: number | null;
          host_payout_amount?: number | null;
          note?: string;
          status?: "requested" | "approved" | "declined" | "active" | "completed" | "cancelled" | "expired" | "missed";
          arrival_signal?: "en_route" | "arrived" | "charging" | "departed" | null;
          expires_at?: string | null;
          grace_expires_at?: string | null;
          session_started_at?: string | null;
          session_ended_at?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          payment_status?: string | null;
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
          actual_kwh?: number | null;
          subtotal_amount?: number | null;
          total_amount?: number;
          platform_fee?: number;
          actual_amount?: number | null;
          host_payout_amount?: number | null;
          note?: string;
          status?: "requested" | "approved" | "declined" | "active" | "completed" | "cancelled" | "expired" | "missed";
          arrival_signal?: "en_route" | "arrived" | "charging" | "departed" | null;
          expires_at?: string | null;
          grace_expires_at?: string | null;
          session_started_at?: string | null;
          session_ended_at?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          payment_status?: string | null;
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
      verification_gates: {
        Row: {
          user_id: string;
          email_verified: boolean;
          phone_verified: boolean;
          payment_method_added: boolean;
          id_verified: boolean;
          id_document_url: string | null;
          stripe_onboarded: boolean;
          stripe_identity_session_id: string | null;
          driver_cleared: boolean;
          host_cleared: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_verified?: boolean;
          phone_verified?: boolean;
          payment_method_added?: boolean;
          id_verified?: boolean;
          id_document_url?: string | null;
          stripe_onboarded?: boolean;
          stripe_identity_session_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email_verified?: boolean;
          phone_verified?: boolean;
          payment_method_added?: boolean;
          id_verified?: boolean;
          id_document_url?: string | null;
          stripe_onboarded?: boolean;
          stripe_identity_session_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_events: {
        Row: {
          id: string;
          event_type: string;
          actor_user_id: string | null;
          actor_role: string | null;
          target_type: string | null;
          target_id: string | null;
          amount_cents: number | null;
          kwh: number | null;
          duration_min: number | null;
          image_url: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          actor_user_id?: string | null;
          actor_role?: string | null;
          target_type?: string | null;
          target_id?: string | null;
          amount_cents?: number | null;
          kwh?: number | null;
          duration_min?: number | null;
          image_url?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          actor_user_id?: string | null;
          actor_role?: string | null;
          target_type?: string | null;
          target_id?: string | null;
          amount_cents?: number | null;
          kwh?: number | null;
          duration_min?: number | null;
          image_url?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_config: {
        Row: {
          key: string;
          value: string;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          value?: string;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      chargers_in_bounds: {
        Args: {
          min_lat: number;
          max_lat: number;
          min_lng: number;
          max_lng: number;
          max_results?: number;
        };
        Returns: {
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
          status: string;
          verification_score: number;
          created_at: string;
          updated_at: string;
        }[];
      };
      create_booking_safe: {
        Args: {
          p_charger_id: string;
          p_driver_id: string;
          p_host_id: string;
          p_start_time: string;
          p_end_time: string;
          p_estimated_kwh: number;
          p_subtotal: number;
          p_fee: number;
          p_total: number;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
