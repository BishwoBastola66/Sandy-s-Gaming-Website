export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'customer' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'suspended' | 'pending';
export type PostType = 'blog' | 'poster' | 'photo';
export type PostStatus = 'draft' | 'published' | 'archived';
export type ConversationStatus = 'active' | 'open' | 'in_progress' | 'resolved' | 'closed';
export type MessageType = 'text' | 'system' | 'media';
export type InquiryStatus = 'new' | 'in_progress' | 'replied' | 'closed';
export type EmailDeliveryStatus =
  | 'pending'
  | 'queued'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed';

export interface MessageAttachment {
  id: string;
  message_id?: string | null;
  conversation_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number | null;
  created_at?: string;
}

export type TicketCategorySlug =
  | 'tournament'
  | 'account'
  | 'gameplay'
  | 'payment'
  | 'bug'
  | 'general'
  | (string & {});

export type TicketPrioritySlug =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent'
  | (string & {});

export interface TicketCategoryItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TicketPriorityItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  level: number;
  color: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          email: string;
          password_hash: string | null;
          display_name: string;
          phone: string | null;
          role: UserRole;
          account_status: AccountStatus;
          provider: string;
          provider_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash?: string | null;
          display_name?: string;
          phone?: string | null;
          role?: UserRole;
          account_status?: AccountStatus;
          provider?: string;
          provider_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string | null;
          display_name?: string;
          phone?: string | null;
          role?: UserRole;
          account_status?: AccountStatus;
          provider?: string;
          provider_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          account_id: string;
          session_token: string;
          ip_address: string | null;
          user_agent: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          session_token: string;
          ip_address?: string | null;
          user_agent?: string | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          session_token?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      account_otps: {
        Row: {
          id: string;
          email: string;
          otp_code: string;
          purpose: string;
          payload: Json | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          otp_code: string;
          purpose?: string;
          payload?: Json | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          otp_code?: string;
          purpose?: string;
          payload?: Json | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          body: string | null;
          post_type: PostType;
          status: PostStatus;
          cover_image: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          slug: string;
          excerpt?: string | null;
          body?: string | null;
          post_type: PostType;
          status?: PostStatus;
          cover_image?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          slug?: string;
          excerpt?: string | null;
          body?: string | null;
          post_type?: PostType;
          status?: PostStatus;
          cover_image?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          storage_path: string;
          media_type: string;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          storage_path: string;
          media_type: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          storage_path?: string;
          media_type?: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          customer_id: string;
          subject: string | null;
          status: ConversationStatus;
          last_message_at: string;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          subject?: string | null;
          status?: ConversationStatus;
          last_message_at?: string;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          subject?: string | null;
          status?: ConversationStatus;
          last_message_at?: string;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          message_type: MessageType;
          created_at: string;
          edited_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          message_type?: MessageType;
          created_at?: string;
          edited_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string;
          message_type?: MessageType;
          created_at?: string;
          edited_at?: string | null;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          message_id: string | null;
          conversation_id: string;
          file_name: string;
          file_url: string;
          file_type: string;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id?: string | null;
          conversation_id: string;
          file_name: string;
          file_url: string;
          file_type?: string;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string | null;
          conversation_id?: string;
          file_name?: string;
          file_url?: string;
          file_type?: string;
          file_size?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contact_inquiries: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          phone: string;
          message: string;
          status: InquiryStatus;
          replied_at: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          email: string;
          phone: string;
          message: string;
          status?: InquiryStatus;
          replied_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string;
          phone?: string;
          message?: string;
          status?: InquiryStatus;
          replied_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_inquiry_replies: {
        Row: {
          id: string;
          inquiry_id: string;
          admin_id: string;
          body: string;
          email_delivery_status: EmailDeliveryStatus;
          provider_message_id: string | null;
          last_delivery_error: string | null;
          idempotency_key: string | null;
          retry_count: number;
          last_attempted_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inquiry_id: string;
          admin_id: string;
          body: string;
          email_delivery_status?: EmailDeliveryStatus;
          provider_message_id?: string | null;
          last_delivery_error?: string | null;
          idempotency_key?: string | null;
          retry_count?: number;
          last_attempted_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          inquiry_id?: string;
          admin_id?: string;
          body?: string;
          email_delivery_status?: EmailDeliveryStatus;
          provider_message_id?: string | null;
          last_delivery_error?: string | null;
          idempotency_key?: string | null;
          retry_count?: number;
          last_attempted_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          customer_id: string;
          title: string;
          description: string;
          category: string;
          priority: string;
          status: string;
          attachments: Json;
          replies: Json;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          title: string;
          description: string;
          category?: string;
          priority?: string;
          status?: string;
          attachments?: Json;
          replies?: Json;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          title?: string;
          description?: string;
          category?: string;
          priority?: string;
          status?: string;
          attachments?: Json;
          replies?: Json;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      ticket_categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          icon: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          icon?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ticket_priorities: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          level: number;
          color: string;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          level?: number;
          color?: string;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          level?: number;
          color?: string;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gaming_platforms: {
        Row: {
          id: string;
          slug: string;
          name: string;
          tagline: string;
          description: string;
          play_url: string;
          category: string;
          tags: string[];
          features: string[];
          platforms: string[];
          logo_url: string | null;
          badge: string | null;
          accent_color: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          tagline: string;
          description: string;
          play_url: string;
          category?: string;
          tags?: string[];
          features?: string[];
          platforms?: string[];
          logo_url?: string | null;
          badge?: string | null;
          accent_color?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          tagline?: string;
          description?: string;
          play_url?: string;
          category?: string;
          tags?: string[];
          features?: string[];
          platforms?: string[];
          logo_url?: string | null;
          badge?: string | null;
          accent_color?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
