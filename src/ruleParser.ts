import { strict as assert } from 'node:assert';
import { createValidatorSyntaxError } from './exceptions';
import { createTokenStream } from './tokenStream';
import type { Rule, ObjectRuleContentValue, SimpleTypeVariant, ObjectRuleIndexValue } from './types/parsingRules';
import type { TokenStream } from './types/tokenizer';
import { UnreachableCaseError, FrozenMap, reprUnknownValue } from './util';

const allSimpleTypes: SimpleTypeVariant[] = [
  'string', 'number', 'bigint', 'boolean', 'symbol', 'object', 'null', 'undefined',
];

/** Returns a yet-to-be-frozen rule */
export function parse(parts: readonly string[]): Rule {
  const tokenStream = createTokenStream(parts);
  if (tokenStream.peek().category === 'eof') {
    throw createValidatorSyntaxError('The validator had no content.');
  }

  const rule = parseRuleAtPrecedence1(tokenStream);

  const lastToken = tokenStream.peek();
  if (lastToken.category !== 'eof') {
    throw createValidatorSyntaxError('Expected EOF.', tokenStream.originalText, lastToken.range);
  }

  return rule;
}

function parseRuleAtPrecedence1(tokenStream: TokenStream): Rule {
  if (tokenStream.peek().category === 'eof') {
    throw createValidatorSyntaxError('Unexpected EOF.', tokenStream.originalText, tokenStream.peek().range);
  }

  const rule: Rule = parseRuleAtPrecedence2(tokenStream);

  if (tokenStream.peek().value === '|') {
    tokenStream.next();
    const nextRule = parseRuleAtPrecedence1(tokenStream);

    return {
      category: 'union',
      variants: [
        ...rule.category === 'union' ? rule.variants : [rule],
        ...nextRule.category === 'union' ? nextRule.variants : [nextRule],
      ],
    };
  } else {
    return rule;
  }
}

function parseRuleAtPrecedence2(tokenStream: TokenStream): Rule {
  if (tokenStream.peek().category === 'eof') {
    throw createValidatorSyntaxError('Unexpected EOF.', tokenStream.originalText, tokenStream.peek().range);
  }

  let rule: Rule = parseRuleAtPrecedence3(tokenStream);

  while (true) {
    if (tokenStream.peek().value === '@') {
      tokenStream.next();
      if (tokenStream.peek().value !== '<') {
        throw createValidatorSyntaxError('Expected an opening angled bracket (`<`).', tokenStream.originalText, tokenStream.peek().range);
      }
      tokenStream.next();

      const entryType = parseRuleAtPrecedence1(tokenStream);
      rule = {
        category: 'iterator' as const,
        iterableType: rule,
        entryType,
      };

      if (tokenStream.peek().value !== '>') {
        throw createValidatorSyntaxError('Expected a closing angled bracket (`>`).', tokenStream.originalText, tokenStream.peek().range);
      }
      tokenStream.next();
    } else if (tokenStream.peek().value === '[') {
      tokenStream.next();
      if (tokenStream.peek().value !== ']') {
        throw createValidatorSyntaxError('Expected a `]` to close the opening `[`.', tokenStream.originalText, tokenStream.peek().range);
      }
      tokenStream.next();
      rule = {
        category: 'array',
        content: rule,
      };
    } else {
      break;
    }
  }

  if (tokenStream.peek().value === '&') {
    tokenStream.next();
    const nextRule = parseRuleAtPrecedence2(tokenStream);

    return {
      category: 'intersection',
      variants: [
        ...rule.category === 'intersection' ? rule.variants : [rule],
        ...nextRule.category === 'intersection' ? nextRule.variants : [nextRule],
      ],
    };
  } else {
    return rule;
  }
}

function parseRuleAtPrecedence3(tokenStream: TokenStream): Rule {
  const token = tokenStream.peek();
  if (token.category === 'number' || (['Infinity', '+', '-'] as unknown[]).includes(token.value)) {
    return {
      category: 'primitiveLiteral',
      value: parseNumber(tokenStream),
    };
  } else if (token.category === 'bigint') {
    tokenStream.next();
    assert(token.value.at(-1) === 'n');
    const numberWithoutSuffix = token.value.slice(0, -1);
    return {
      category: 'primitiveLiteral',
      value: BigInt(numberWithoutSuffix),
    };
  } else if ((['true', 'false'] as unknown[]).includes(token.value)) {
    tokenStream.next();
    return {
      category: 'primitiveLiteral',
      value: token.value === 'true',
    };
  } else if (token.category === 'string') {
    tokenStream.next();
    return {
      category: 'primitiveLiteral',
      value: token.parsedValue,
    };
  } else if (token.category === 'identifier') {
    return parseLiteralOrNoop(tokenStream);
  } else if (token.category === 'interpolation') {
    const interpolationToken = tokenStream.next();
    assert(interpolationToken.category === 'interpolation');
    return {
      category: 'interpolation',
      interpolationIndex: interpolationToken.interpolationIndex,
    };
  } else if (token.value === '(') {
    tokenStream.next();
    const rule = parseRuleAtPrecedence1(tokenStream);
    const closingParenToken = tokenStream.next();
    if (closingParenToken.value !== ')') {
      throw createValidatorSyntaxError('Expected to find a closing parentheses (`)`) here.', tokenStream.originalText, closingParenToken.range);
    }
    return rule;
  } else if (token.value === '{') {
    return parseObject(tokenStream);
  } else if (token.value === '[') {
    return parseTuple(tokenStream);
  } else {
    throw createValidatorSyntaxError('Expected to find a type here.', tokenStream.originalText, tokenStream.peek().range);
  }
}

function parseLiteralOrNoop(tokenStream: TokenStream): Rule {
  const token = tokenStream.next();
  assert(token.category === 'identifier');

  const identifier = token.value;
  if (identifier === 'unknown' || identifier === 'any') {
    return {
      category: 'noop',
    };
  } else if ((allSimpleTypes as string[]).includes(identifier)) {
    return {
      category: 'simple',
      type: identifier as SimpleTypeVariant,
    };
  } else {
    throw createValidatorSyntaxError('Expected to find a type here.', tokenStream.originalText, token.range);
  }
}

function parseObject(tokenStream: TokenStream): Rule {
  assert(tokenStream.next().value === '{');
  const ruleTemplate = {
    category: 'object' as const,
    contentEntries: [] as Array<[string, ObjectRuleContentValue]>,
    dynamicContentEntries: [] as Array<[number, ObjectRuleContentValue]>,
    index: null as ObjectRuleIndexValue | null,
  };
  const foundKeys = new Set<string>();

  while (true) {
    if (tokenStream.peek().value === '}') {
      tokenStream.next();
      break;
    }

    const beforeKeyPos = tokenStream.peek().range.start;
    const keyInfo = parseObjectKey(tokenStream);
    const keyRange = { start: beforeKeyPos, end: tokenStream.last().range.end };

    const colonToken = tokenStream.next();
    if (colonToken.value !== ':') {
      throw createValidatorSyntaxError('Expected a colon (`:`) to separate the key from the value.', tokenStream.originalText, colonToken.range);
    }

    const valueRule = parseRuleAtPrecedence1(tokenStream);

    if ('indexType' in keyInfo) {
      if (ruleTemplate.index !== null) {
        throw createValidatorSyntaxError(
          'Can not have multiple index types in the same object.',
          tokenStream.originalText,
          keyRange,
        );
      }
      ruleTemplate.index = {
        key: keyInfo.indexType,
        value: valueRule,
        label: keyInfo.name,
      };
    } else if ('keyInterpolationIndex' in keyInfo) {
      const { keyInterpolationIndex, optional } = keyInfo;
      ruleTemplate.dynamicContentEntries.push([keyInterpolationIndex, {
        optional,
        rule: valueRule,
      }]);
    } else {
      const { key, optional } = keyInfo;
      if (foundKeys.has(key)) {
        throw createValidatorSyntaxError(`Duplicate key ${reprUnknownValue(key)} found.`, tokenStream.originalText, keyRange);
      }
      foundKeys.add(key);
      ruleTemplate.contentEntries.push([key, {
        optional,
        rule: valueRule,
      }]);
    }

    const separatorToken = tokenStream.peek();
    if (([',', ';'] as unknown[]).includes(separatorToken.value)) {
      tokenStream.next();
    } else if (separatorToken.value !== '}' && !separatorToken.afterNewline) {
      throw createValidatorSyntaxError('Expected a comma (`,`) or closing bracket (`}`).', tokenStream.originalText, separatorToken.range);
    }
  }

  return {
    category: 'object' as const,
    content: new FrozenMap(ruleTemplate.contentEntries),
    dynamicContent: new FrozenMap(ruleTemplate.dynamicContentEntries),
    index: ruleTemplate.index,
  };
}

type ParseObjectKeyReturn = {
  readonly key: string
  readonly optional: boolean
} | {
  readonly keyInterpolationIndex: number
  readonly optional: boolean
} | {
  readonly indexType: Rule
  readonly name: string
};

function parseObjectKey(tokenStream: TokenStream): ParseObjectKeyReturn {
  if (tokenStream.peek().value === '[') {
    tokenStream.next();
    if (tokenStream.peek().category === 'interpolation') {
      // parse dynamic key

      const interpolationKey = tokenStream.next();
      assert(interpolationKey.category === 'interpolation');

      const endBracketToken = tokenStream.next();
      if (endBracketToken.value !== ']') {
        throw createValidatorSyntaxError('Expected a closing right bracket (`]`).', tokenStream.originalText, endBracketToken.range);
      }

      let optional = false;
      if (tokenStream.peek().value === '?') {
        tokenStream.next();
        optional = true;
      }

      return {
        keyInterpolationIndex: interpolationKey.interpolationIndex,
        optional,
      };
    } else if (tokenStream.peek().category === 'identifier') {
      // parse index type

      const nameToken = tokenStream.next();
      assert(nameToken.category === 'identifier');

      const colonToken = tokenStream.next();
      if (colonToken.value !== ':') {
        throw createValidatorSyntaxError(
          "Expected a colon here to separate the index key's name on the left, from a type on the right.",
          tokenStream.originalText,
          colonToken.range,
        );
      }

      const beforeIndexType = tokenStream.peek().range.start;
      const indexType = parseRuleAtPrecedence1(tokenStream);
      const afterIndexType = tokenStream.last().range.end;

      const endBracketToken = tokenStream.next();
      if (endBracketToken.value !== ']') {
        throw createValidatorSyntaxError('Expected a closing right bracket (`]`).', tokenStream.originalText, endBracketToken.range);
      }

      if (indexType.category !== 'simple' || !['string', 'number', 'symbol'].includes(indexType.type)) {
        throw createValidatorSyntaxError(
          'An index type must be either "string", "number", or "symbol".',
          tokenStream.originalText,
          { start: beforeIndexType, end: afterIndexType },
        );
      }

      return { indexType, name: nameToken.value };
    } else {
      throw createValidatorSyntaxError(
        'Expected an identifier, followed by ":" and a type, if this is meant to be a mapped type,\n' +
        'or expected an interpolated value if this is meant to be a dynamic key.',
        tokenStream.originalText,
        tokenStream.peek().range,
      );
    }
  } else {
    const containsOnlyNumbers = (text: string): boolean => /^\d+$/.exec(text) !== null;
    const keyToken = tokenStream.next();
    const isValidKey = (
      keyToken.category === 'identifier' ||
      (keyToken.category === 'number' && containsOnlyNumbers(keyToken.value)) ||
      keyToken.category === 'string'
    );
    if (!isValidKey) {
      throw createValidatorSyntaxError('Expected an object key or closing bracket (`}`).', tokenStream.originalText, keyToken.range);
    }
    const key = keyToken.category === 'string' ? keyToken.parsedValue : keyToken.value;

    let optional = false;
    if (tokenStream.peek().value === '?') {
      tokenStream.next();
      optional = true;
    }

    return { key, optional };
  }
}

function parseTuple(tokenStream: TokenStream): Rule {
  assert(tokenStream.next().value === '[');
  const rule = {
    category: 'tuple' as const,
    content: [] as Rule[],
    optionalContent: [] as Rule[],
    rest: null as Rule | null,
    entryLabels: null as string[] | null,
  };

  if (tokenStream.peek().value === ']') {
    tokenStream.next();
    return rule;
  }

  if (tokenStream.peek().value === ',') {
    throw createValidatorSyntaxError('Expected a tuple entry or a closing bracket (`]`).', tokenStream.originalText, tokenStream.peek().range);
  }

  let requiredPropertiesAllowed = true;
  let entryNameRequired: 'ALWAYS' | 'NEVER' | 'UNDECIDED' = 'UNDECIDED';
  while (true) {
    const { behaviorCategory, rule: entryRule, entryName } = parseTupleEntry(tokenStream, { entryNameRequired, requiredPropertiesAllowed });
    if (behaviorCategory === 'REQUIRED') {
      rule.content.push(entryRule);
    } else if (behaviorCategory === 'OPTIONAL') {
      rule.optionalContent.push(entryRule);
    } else if (behaviorCategory === 'REST') {
      rule.rest = entryRule;
    } else {
      throw new UnreachableCaseError(behaviorCategory);
    }

    if (entryNameRequired === 'UNDECIDED') {
      entryNameRequired = entryName !== null ? 'ALWAYS' : 'NEVER';
    }

    if (entryName !== null) {
      if (rule.entryLabels === null) {
        rule.entryLabels = [];
      }
      rule.entryLabels.push(entryName);
    }

    {
      const token = tokenStream.next();

      if (token.value === ']' || (token.value === ',' && tokenStream.peek().value === ']')) {
        if (token.value !== ']') tokenStream.next();
        break;
      }

      if (token.value !== ',') {
        throw createValidatorSyntaxError('Expected a comma (`,`) or closing bracket (`]`).', tokenStream.originalText, token.range);
      }
    }

    if (behaviorCategory === 'OPTIONAL') {
      requiredPropertiesAllowed = false;
    } else if (behaviorCategory === 'REST') {
      throw createValidatorSyntaxError(
        'Found unexpected content after a rest entry. A rest entry must be the last item in the tuple.',
        tokenStream.originalText,
        tokenStream.peek().range,
      );
    }
  }

  return rule;
}

interface ParseTupleEntryOpts {
  readonly entryNameRequired: 'ALWAYS' | 'NEVER' | 'UNDECIDED'
  readonly requiredPropertiesAllowed: boolean
}

interface ParseTupleEntryReturn {
  readonly behaviorCategory: 'REQUIRED' | 'OPTIONAL' | 'REST'
  readonly entryName: string | null
  readonly rule: Rule
}

function parseTupleEntry(tokenStream: TokenStream, { entryNameRequired, requiredPropertiesAllowed }: ParseTupleEntryOpts): ParseTupleEntryReturn {
  const startPos = tokenStream.peek().range.start;

  const isRest = tokenStream.peek().value === '...';
  if (isRest) {
    tokenStream.next();
  }

  // Not null if a name was found.
  const parsedNameRegionResult = tryParseTupleEntryNameRegion(tokenStream);

  const rule = parseRuleAtPrecedence1(tokenStream);

  // `false` means its not optional, or its not an unnamed field.
  const isUnnamedFieldOptional = tokenStream.peek().value === '?';
  if (isUnnamedFieldOptional) {
    tokenStream.next();
  }

  const errorRange = { start: startPos, end: tokenStream.last().range.end };

  if (
    (entryNameRequired === 'ALWAYS' && parsedNameRegionResult === null) ||
    (entryNameRequired === 'NEVER' && parsedNameRegionResult !== null)
  ) {
    throw createValidatorSyntaxError(
      'A tuple must either have all of its entries be named, or none of its entries be named.',
      tokenStream.originalText,
      errorRange,
    );
  }

  if (isUnnamedFieldOptional && parsedNameRegionResult !== null) {
    throw createValidatorSyntaxError(
      'To mark a named tuple entry as optional, place the question mark (`?`) before the colon (`:`).',
      tokenStream.originalText,
      tokenStream.last().range,
    );
  }

  if (isRest && (parsedNameRegionResult?.optional === true || isUnnamedFieldOptional)) {
    throw createValidatorSyntaxError('A tuple entry can not both be rest (...) and optional (?).', tokenStream.originalText, errorRange);
  }

  if (isRest) {
    return { behaviorCategory: 'REST', entryName: parsedNameRegionResult?.name ?? null, rule };
  }
  if (parsedNameRegionResult?.optional === true || isUnnamedFieldOptional) {
    return { behaviorCategory: 'OPTIONAL', entryName: parsedNameRegionResult?.name ?? null, rule };
  }

  if (requiredPropertiesAllowed) {
    return { behaviorCategory: 'REQUIRED', entryName: parsedNameRegionResult?.name ?? null, rule };
  } else {
    throw createValidatorSyntaxError('Required entries can not appear after optional entries.', tokenStream.originalText, errorRange);
  }
}

function tryParseTupleEntryNameRegion(tokenStream: TokenStream): { name: string, optional: boolean } | null {
  const entryNameToken = tokenStream.peek(1);
  if (entryNameToken.category !== 'identifier') {
    return null;
  }

  const optional = tokenStream.peek(2).value === '?';
  const colonPeekIndex = optional ? 3 : 2;
  if (tokenStream.peek(colonPeekIndex).value !== ':') {
    return null;
  }

  for (let i = 0; i < (optional ? 3 : 2); ++i) {
    tokenStream.next();
  }

  return { name: entryNameToken.value, optional };
}

function parseNumber(tokenStream: TokenStream): number {
  let sign = '+';
  if ((['-', '+'] as unknown[]).includes(tokenStream.peek().value)) {
    const signToken = tokenStream.next();
    assert(signToken.category === 'specialChar');
    sign = signToken.value;
  }

  const numberToken = tokenStream.next();

  if (numberToken.category !== 'number' && numberToken.value !== 'Infinity') {
    throw createValidatorSyntaxError('Expected a number after the sign.', tokenStream.originalText, numberToken.range);
  }

  if (/^0[0-7_]+([e.].*)?$/.exec(numberToken.value) !== null) {
    throw createValidatorSyntaxError(
      'Not allowed to use legacy octal syntax. Use 0o123 syntax instead.',
      tokenStream.originalText,
      numberToken.range,
    );
  }
  if (/^0\d+e\d*$/.exec(numberToken.value) !== null) {
    throw createValidatorSyntaxError(
      'Can not mix scientific notation with numbers starting with leading zeros.',
      tokenStream.originalText,
      numberToken.range,
    );
  }

  const value = Number(numberToken.value.replace(/_/g, '')) * (sign === '-' ? -1 : 1);
  assert(!isNaN(value));
  return value;
}
