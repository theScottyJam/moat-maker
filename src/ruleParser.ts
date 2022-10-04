import { strict as assert } from 'node:assert';
import { createValidatorSyntaxError } from './exceptions';
import { createTokenStream } from './tokenStream';
import { freezeRule } from './ruleFreezer';
import { Rule, ObjectRuleContentValue, simpleTypeVariant } from './types/parseRules';
import { TokenStream } from './types/tokenizer';
import { UnreachableCaseError, FrozenMap } from './util';

const allSimpleTypes: simpleTypeVariant[] = [
  'string', 'number', 'bigint', 'boolean', 'symbol', 'object', 'null', 'undefined',
];

export function parse(parts: readonly string[]): Rule {
  const tokenStream = createTokenStream(parts);
  if (tokenStream.peek().category === 'eof') {
    throw createValidatorSyntaxError('The validator had no content.');
  }

  const rule = parseRule(tokenStream);

  const lastToken = tokenStream.peek();
  if (lastToken.category !== 'eof') {
    throw createValidatorSyntaxError('Expected EOF.', tokenStream.originalText, lastToken.range);
  }

  return freezeRule(rule);
}

function parseRule(tokenStream: TokenStream): Rule {
  if (tokenStream.peek().category === 'eof') {
    throw createValidatorSyntaxError('Unexpected EOF.', tokenStream.originalText, tokenStream.peek().range);
  }

  let rule: Rule = parseRuleWithoutModifiers(tokenStream);

  while (true) {
    if (tokenStream.peek().value === '@') {
      tokenStream.next();
      if (tokenStream.peek().value !== '<') {
        throw createValidatorSyntaxError('Expected an opening angled bracket (`<`).', tokenStream.originalText, tokenStream.peek().range);
      }
      tokenStream.next();

      const entryType = parseRule(tokenStream);
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

  if (tokenStream.peek().value === '|') {
    tokenStream.next();
    const subRule = parseRule(tokenStream);
    const subRules = subRule.category === 'union'
      ? subRule.variants
      : [subRule];

    return {
      category: 'union',
      variants: [rule, ...subRules],
    };
  } else {
    return rule;
  }
}

/// Parse a rule, without worrying about things tacked onto it, like `[]`
/// to make it an array, or `|` to "union" it with another rule.
function parseRuleWithoutModifiers(tokenStream: TokenStream): Rule {
  const token = tokenStream.peek();
  if (token.category === 'identifier') {
    return parseLiteralOrNoop(tokenStream);
  } else if (token.category === 'string') {
    tokenStream.next();
    return {
      category: 'primitiveLiteral',
      value: token.parsedValue,
    };
  } else if (token.category === 'interpolation') {
    tokenStream.next();
    return {
      category: 'interpolation',
      interpolationIndex: token.range.start.sectionIndex,
    };
  } else if (token.value === '{') {
    return parseObject(tokenStream);
  } else if (token.value === '[') {
    return parseTuple(tokenStream);
  } else {
    // TODO: Add tests for this
    throw new Error('Invalid input');
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
      type: identifier as simpleTypeVariant,
    };
  } else {
    // TODO: Add tests for this
    throw new Error('Invalid input');
  }
}

function parseObject(tokenStream: TokenStream): Rule {
  assert(tokenStream.next().value === '{');
  const ruleTemplate = {
    category: 'object' as const,
    contentEntries: [] as Array<[string, ObjectRuleContentValue]>,
    index: null,
  };

  while (true) {
    if (tokenStream.peek().value === '}') {
      tokenStream.next();
      break;
    }

    const containsOnlyNumbers = (text: string): boolean => /^\d+$/.exec(text) !== null;
    const keyToken = tokenStream.next();
    const isValidKey = (
      keyToken.category === 'identifier' ||
      (keyToken.category === 'number' && containsOnlyNumbers(keyToken.value))
    );
    if (!isValidKey) {
      throw createValidatorSyntaxError('Expected an object key or closing bracket (`}`).', tokenStream.originalText, keyToken.range);
    }

    let optional = false;
    if (tokenStream.peek().value === '?') {
      tokenStream.next();
      optional = true;
    }

    const colonToken = tokenStream.next();
    if (colonToken.value !== ':') {
      throw createValidatorSyntaxError('Expected a colon (`:`) to separate the key from the value.', tokenStream.originalText, colonToken.range);
    }

    const valueRule = parseRule(tokenStream);

    ruleTemplate.contentEntries.push([keyToken.value, {
      optional,
      rule: valueRule,
    }]);

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
    index: ruleTemplate.index,
  };
}

function parseTuple(tokenStream: TokenStream): Rule {
  assert(tokenStream.next().value === '[');
  const rule = {
    category: 'tuple' as const,
    content: [] as Rule[],
    optionalContent: [] as Rule[],
    rest: null as Rule | null,
  };

  if (tokenStream.peek().value === ']') {
    tokenStream.next();
    return rule;
  }

  if (tokenStream.peek().value === ',') {
    throw createValidatorSyntaxError('Expected a tuple entry or a closing bracket (`]`).', tokenStream.originalText, tokenStream.peek().range);
  }

  let requiredFieldsAllowed = true;
  while (true) {
    const { behaviorCategory, rule: entryRule } = parseTupleEntry(tokenStream, { requiredFieldsAllowed });
    if (behaviorCategory === 'REQUIRED') {
      rule.content.push(entryRule);
    } else if (behaviorCategory === 'OPTIONAL') {
      rule.optionalContent.push(entryRule);
    } else if (behaviorCategory === 'REST') {
      rule.rest = entryRule;
    } else {
      throw new UnreachableCaseError(behaviorCategory);
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
      requiredFieldsAllowed = false;
    } else if (behaviorCategory === 'REST') {
      // TODO: This error is probably being thrown, even if there's simply an EOF after the rest entry.
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
  readonly requiredFieldsAllowed: boolean
}

interface ParseTupleEntryReturn {
  readonly behaviorCategory: 'REQUIRED' | 'OPTIONAL' | 'REST'
  readonly rule: Rule
}

function parseTupleEntry(tokenStream: TokenStream, { requiredFieldsAllowed }: ParseTupleEntryOpts): ParseTupleEntryReturn {
  if (tokenStream.peek().value === '...') {
    tokenStream.next();
    return { behaviorCategory: 'REST', rule: parseRule(tokenStream) };
  }

  const valueRuleStartPos = tokenStream.peek().range.start;
  const rule = parseRule(tokenStream);
  if (tokenStream.peek().value === '?') {
    tokenStream.next();
    return { behaviorCategory: 'OPTIONAL', rule };
  }

  if (requiredFieldsAllowed) {
    return { behaviorCategory: 'REQUIRED', rule };
  } else {
    const range = { start: valueRuleStartPos, end: tokenStream.lastTokenEndPos() };
    throw createValidatorSyntaxError('Required entries can not appear after optional entries.', tokenStream.originalText, range);
  }
}
