export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      PoolDeposit: {
        Row: {
          amountStaked: number
          id: number
          stakingPoolId: number
          status: Database["public"]["Enums"]["DepositStatus"]
          timestamp: string
          transactionHash: string | null
          userId: number
        }
        Insert: {
          amountStaked: number
          id?: number
          stakingPoolId: number
          status?: Database["public"]["Enums"]["DepositStatus"]
          timestamp?: string
          transactionHash?: string | null
          userId: number
        }
        Update: {
          amountStaked?: number
          id?: number
          stakingPoolId?: number
          status?: Database["public"]["Enums"]["DepositStatus"]
          timestamp?: string
          transactionHash?: string | null
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "PoolDeposit_stakingPoolId_fkey"
            columns: ["stakingPoolId"]
            isOneToOne: false
            referencedRelation: "StakingPool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PoolDeposit_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      PoolWithdrawal: {
        Row: {
          amountWithdrawn: number
          id: number
          stakingPoolId: number
          status: Database["public"]["Enums"]["WithdrawalStatus"]
          timestamp: string
          transactionHash: string | null
          userId: number
        }
        Insert: {
          amountWithdrawn: number
          id?: number
          stakingPoolId: number
          status?: Database["public"]["Enums"]["WithdrawalStatus"]
          timestamp?: string
          transactionHash?: string | null
          userId: number
        }
        Update: {
          amountWithdrawn?: number
          id?: number
          stakingPoolId?: number
          status?: Database["public"]["Enums"]["WithdrawalStatus"]
          timestamp?: string
          transactionHash?: string | null
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "PoolWithdrawal_stakingPoolId_fkey"
            columns: ["stakingPoolId"]
            isOneToOne: false
            referencedRelation: "StakingPool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PoolWithdrawal_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      StakingPool: {
        Row: {
          blockchainPoolId: number | null
          createdAt: string
          id: number
          poolStatus: Database["public"]["Enums"]["PoolStatus"]
          rewardRate: number
          totalRewardsPaid: number
          totalStakedAmount: number
          updatedAt: string
        }
        Insert: {
          blockchainPoolId?: number | null
          createdAt?: string
          id?: number
          poolStatus?: Database["public"]["Enums"]["PoolStatus"]
          rewardRate: number
          totalRewardsPaid?: number
          totalStakedAmount?: number
          updatedAt: string
        }
        Update: {
          blockchainPoolId?: number | null
          createdAt?: string
          id?: number
          poolStatus?: Database["public"]["Enums"]["PoolStatus"]
          rewardRate?: number
          totalRewardsPaid?: number
          totalStakedAmount?: number
          updatedAt?: string
        }
        Relationships: []
      }
      User: {
        Row: {
          createdAt: string
          email: string
          ethereumAddress: string | null
          firstName: string
          id: number
          lastName: string
          supabaseUserId: string
        }
        Insert: {
          createdAt?: string
          email: string
          ethereumAddress?: string | null
          firstName: string
          id?: number
          lastName: string
          supabaseUserId: string
        }
        Update: {
          createdAt?: string
          email?: string
          ethereumAddress?: string | null
          firstName?: string
          id?: number
          lastName?: string
          supabaseUserId?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      DepositStatus: "pending" | "completed" | "failed"
      PoolStatus: "active" | "disabled" | "paused" | "closed" | "completed"
      WithdrawalStatus: "pending" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      DepositStatus: ["pending", "completed", "failed"],
      PoolStatus: ["active", "disabled", "paused", "closed", "completed"],
      WithdrawalStatus: ["pending", "completed", "failed"],
    },
  },
} as const
