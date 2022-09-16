import { ValidatorSyntaxError } from './exceptions';
import { createTokenStream } from './tokenStream';
import { Rule, simpleTypeVariant } from './types/parseRules';
import { TokenStream } from './types/tokenizer';
import { UnreachableCaseError } from './util';

const allSimpleTypes: simpleTypeVariant[] = [
  'string', 'number', 'bigint', 'boolean', 'symbol', 'object', 'null', 'undefined',
];

export function parse(parts: TemplateStringsArray): Rule {
  const tokenStream = createTokenStream(parts);
  if (tokenStream.peek().category === 'eof') {
    throw new ValidatorSyntaxError('The validator had no content.');
  }
  return ruleFromTokenStream(tokenStream);
}

function ruleFromTokenStream(tokenStream: TokenStream): Rule {
  const token = tokenStream.next();
  if (token.category === 'eof') {
    throw new ValidatorSyntaxError('Unexpected EOF.', tokenStream.originalText, token.range);
  }

  let rule: Rule;
  if (token.category === 'identifier') {
    const identifier = token.value;
    if (identifier === 'unknown' || identifier === 'any') {
      rule = freezeRule({
        category: 'noop',
      });
    } else if ((allSimpleTypes as string[]).includes(identifier)) {
      rule = freezeRule({
        category: 'simple',
        type: identifier as simpleTypeVariant,
      });
    } else {
      // TODO: Add tests for this
      throw new Error('Invalid input');
    }
  } else {
    // TODO: Add tests for this
    throw new Error('Invalid input');
  }

  if (tokenStream.peek().value === '|') {
    tokenStream.next();
    const subRule = ruleFromTokenStream(tokenStream);
    const subRules = subRule.category === 'union'
      ? subRule.variants
      : [subRule];

    return freezeRule({
      category: 'union',
      variants: [rule, ...subRules],
    });
  } else {
    const nextToken = tokenStream.peek();
    if (nextToken.category !== 'eof') {
      throw new ValidatorSyntaxError('Expected EOF.', tokenStream.originalText, nextToken.range);
    }

    return rule;
  }
}

export function freezeRule(rule: Rule): Rule {
  // shallow-copy-and-freeze function
  const f = <T>(objOrArray: T): T => {
    if (Object.isFrozen(objOrArray)) {
      return objOrArray;
    }
    return Object.freeze(
      Array.isArray(objOrArray) ? [...objOrArray] : { ...objOrArray },
    ) as T;
  };

  if (rule.category === 'simple' || rule.category === 'noop') {
    return f({ ...rule });
  } else if (rule.category === 'union') {
    return f({
      ...rule,
      variants: f([...rule.variants]),
    });
  } else {
    throw new UnreachableCaseError(rule);
  }
}
