import { assert, UnreachableCaseError } from '../util.js';
import { isIdentifier } from '../ruleParser/index.js';

export type PathSegment =
  { category: 'accessProperty', propertyKey: string | symbol }
  | { category: 'indexArray', index: number }
  | { category: 'sliceArray', from: number }
  | { category: 'convertToArray' };

interface CustomStringifierOpts {
  readonly rootText: string
  readonly pathSegments: readonly PathSegment[]
}

type CustomStringifier = (opts: CustomStringifierOpts) => string;

interface ConstructorOpts {
  customStringifier?: CustomStringifier | undefined
  pathSegments?: readonly PathSegment[]
}

export class LookupPath {
  readonly #rootText: string;
  readonly #customStringifier: CustomStringifier | undefined;
  readonly pathSegments: readonly PathSegment[];
  constructor(rootText = '<receivedValue>', { customStringifier, pathSegments = [] }: ConstructorOpts = {}) {
    this.#rootText = rootText;
    this.#customStringifier = customStringifier;
    this.pathSegments = pathSegments;
  }

  isParentOf(other: LookupPath): boolean {
    if (this.pathSegments.length <= other.pathSegments.length) {
      return false;
    }

    return other.pathSegments.every((otherSegment, i) => {
      const thisSegment = this.pathSegments[i];
      assert(thisSegment !== undefined);
      return LookupPath.comparePathSegments(thisSegment, otherSegment);
    });
  }

  static comparePathSegments(segment1: PathSegment, segment2: PathSegment): boolean {
    if (segment1.category === 'accessProperty') {
      return segment2.category === 'accessProperty' && segment1.propertyKey === segment2.propertyKey;
    } else if (segment1.category === 'indexArray') {
      return segment2.category === 'indexArray' && segment1.index === segment2.index;
    } else if (segment1.category === 'sliceArray') {
      return segment2.category === 'sliceArray' && segment1.from === segment2.from;
    } else if (segment1.category === 'convertToArray') {
      return segment2.category === 'convertToArray';
    } else {
      throw new UnreachableCaseError(segment1);
    }
  }

  #push(pathSegment: PathSegment): LookupPath {
    return new LookupPath(this.#rootText, {
      customStringifier: this.#customStringifier,
      pathSegments: [...this.pathSegments, pathSegment],
    });
  }

  #pop(): LookupPath {
    return new LookupPath(this.#rootText, {
      customStringifier: this.#customStringifier,
      pathSegments: this.pathSegments.slice(0, -1),
    });
  }

  thenAccessProperty(propertyKey: string | symbol): LookupPath {
    return this.#push({ category: 'accessProperty', propertyKey });
  }

  thenIndexArray(index: number): LookupPath {
    let newPath = this as LookupPath;
    let updatedIndex = index;
    while (true) {
      const segment = at(newPath.pathSegments, -1);
      if (segment?.category !== 'sliceArray') {
        break;
      }

      newPath = newPath.#pop();
      updatedIndex += segment.from;
    }
    return newPath.#push({ category: 'indexArray', index: updatedIndex });
  }

  thenSliceArray({ from }: { from: number }): LookupPath {
    return this.#push({ category: 'sliceArray', from });
  }

  thenConvertToArray(): LookupPath {
    return this.#push({ category: 'convertToArray' });
  }

  asString(): string {
    if (this.#customStringifier !== undefined) {
      return this.#customStringifier({
        rootText: this.#rootText,
        pathSegments: this.pathSegments,
      });
    }

    let path = this.#rootText;
    for (const segment of this.pathSegments) {
      if (segment.category === 'accessProperty') {
        if (typeof segment.propertyKey === 'string' && isIdentifier(segment.propertyKey)) {
          path = `${path}.${segment.propertyKey}`;
        } else if (typeof segment.propertyKey === 'string') {
          path = `${path}[${JSON.stringify(segment.propertyKey)}]`;
        } else {
          path = `${path}[Symbol(${segment.propertyKey.description ?? ''})]`;
        }
      } else if (segment.category === 'indexArray') {
        path = `${path}[${segment.index}]`;
      } else if (segment.category === 'sliceArray') {
        path = `${path}.slice(${segment.from})`;
      } else if (segment.category === 'convertToArray') {
        path = `[...${path}]`;
      } else {
        throw new UnreachableCaseError(segment);
      }
    }

    return path;
  }
}

// This function was recently added as a native JavaScript function.
function at<T>(array: readonly T[], index: number): T | undefined {
  if (index >= 0) {
    return array[index];
  } else {
    return array[array.length + index];
  }
}
