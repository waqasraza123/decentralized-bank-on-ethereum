export type PrismaJsonObject = {
  [key: string]: PrismaJsonValue | null;
};

export type PrismaJsonArray = Array<PrismaJsonValue | null>;

export type PrismaJsonValue =
  | string
  | number
  | boolean
  | PrismaJsonObject
  | PrismaJsonArray;
