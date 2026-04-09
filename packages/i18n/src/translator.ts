interface MessageCatalog {
  [key: string]: string | MessageCatalog;
}

type PrimitiveInterpolationValue = string | number | boolean | null | undefined;

export type TranslationVariables = Record<string, PrimitiveInterpolationValue>;

type DotPath<T> = T extends string
  ? never
  : {
      [K in keyof T & string]:
        T[K] extends string
          ? K
          : K | `${K}.${DotPath<T[K]>}`;
    }[keyof T & string];

export type Translator<TMessages extends MessageCatalog> = (
  key: DotPath<TMessages>,
  variables?: TranslationVariables
) => string;

function resolveNestedValue(
  input: MessageCatalog,
  key: string
): string {
  const segments = key.split(".");
  let currentValue: string | MessageCatalog | undefined = input;

  for (const segment of segments) {
    if (!currentValue || typeof currentValue === "string") {
      throw new Error(`Translation key "${key}" could not be resolved.`);
    }

    currentValue = currentValue[segment];
  }

  if (typeof currentValue !== "string") {
    throw new Error(`Translation key "${key}" did not resolve to a string.`);
  }

  return currentValue;
}

function interpolateMessage(
  message: string,
  variables?: TranslationVariables
): string {
  if (!variables) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (_match, token) => {
    const value = variables[token];
    return value === null || typeof value === "undefined" ? "" : String(value);
  });
}

export function createTranslator<TMessages extends MessageCatalog>(
  messages: TMessages
): Translator<TMessages> {
  return (key, variables) =>
    interpolateMessage(resolveNestedValue(messages, key), variables);
}

export function collectTranslationKeys(
  input: MessageCatalog,
  prefix = ""
): string[] {
  return Object.entries(input).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      return [nextKey];
    }

    return collectTranslationKeys(value, nextKey);
  });
}
