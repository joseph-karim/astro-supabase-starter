export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      claims: {
        Row: {
          id: string;
          slug: string;
          h1: string;
          tl_dr: string;
          pull_quotes: string[];
          proof_table: Json | null;
          csv_url: string | null;
          jsonld: Json | null;
          updated_at: string;
          published: boolean;
        };
        Insert: {
          id?: string;
          slug: string;
          h1: string;
          tl_dr: string;
          pull_quotes?: string[];
          proof_table?: Json | null;
          csv_url?: string | null;
          jsonld?: Json | null;
          updated_at?: string;
          published?: boolean;
        };
        Update: {
          id?: string;
          slug?: string;
          h1?: string;
          tl_dr?: string;
          pull_quotes?: string[];
          proof_table?: Json | null;
          csv_url?: string | null;
          jsonld?: Json | null;
          updated_at?: string;
          published?: boolean;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          claim_slug: string;
          referrer: string | null;
          is_ai_referrer: boolean;
          page: string;
          event_type: string;
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_slug: string;
          referrer?: string | null;
          is_ai_referrer?: boolean;
          page: string;
          event_type: string;
          meta?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_slug?: string;
          referrer?: string | null;
          is_ai_referrer?: boolean;
          page?: string;
          event_type?: string;
          meta?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      frameworks: {
        Row: {
          description: string;
          created_at: string;
          url: string;
          id: string;
          logo: string;
          name: string;
          likes: number;
        };
        Insert: {
          description: string;
          created_at?: string;
          url: string;
          id?: string;
          logo: string;
          name: string;
          likes?: number;
        };
        Update: {
          description?: string;
          created_at?: string;
          url?: string;
          id?: string;
          logo?: string;
          name?: string;
          likes?: number;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          email: string;
          company: string | null;
          icp: Json | null;
          pains: string[];
          proof_links: string[];
          competitors: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          company?: string | null;
          icp?: Json | null;
          pains?: string[];
          proof_links?: string[];
          competitors?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          company?: string | null;
          icp?: Json | null;
          pains?: string[];
          proof_links?: string[];
          competitors?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      tests: {
        Row: {
          id: string;
          claim_id: string | null;
          engine: string;
          query: string;
          appeared: boolean;
          cited: boolean;
          clickable: boolean;
          screenshot_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id?: string | null;
          engine: string;
          query: string;
          appeared?: boolean;
          cited?: boolean;
          clickable?: boolean;
          screenshot_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string | null;
          engine?: string;
          query?: string;
          appeared?: boolean;
          cited?: boolean;
          clickable?: boolean;
          screenshot_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tests_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          }
        ];
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
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;
