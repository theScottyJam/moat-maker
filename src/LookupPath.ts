import { UnreachableCaseError } from './util';
import { isIdentifier } from './tokenStream';

type PathSegment =
  { category: 'thenAccessProperty', propertyKey: string | symbol }
  | { category: 'indexArray', index: number }
  | { category: 'sliceArray', from: number }
  | { category: 'convertToArray' };

export class LookupPath {
  #rootText: string;
  #pathSegments: readonly PathSegment[];
  constructor(rootText = '<receivedValue>', { _pathSegments = [] }: { _pathSegments?: readonly PathSegment[] } = {}) {
    this.#rootText = rootText;
    this.#pathSegments = _pathSegments;
  }

  #push(pathSegment: PathSegment): LookupPath {
    return new LookupPath(this.#rootText, {
      _pathSegments: [...this.#pathSegments, pathSegment],
    });
  }

  #pop(): LookupPath {
    return new LookupPath(this.#rootText, {
      _pathSegments: this.#pathSegments.slice(0, -1),
    });
  }

  thenAccessProperty(propertyKey: string | symbol): LookupPath {
    return this.#push({ category: 'thenAccessProperty', propertyKey });
  }

  thenIndexArray(index: number): LookupPath {
    let newPath = this as LookupPath;
    let updatedIndex = index;
    while (true) {
      const segment = at(newPath.#pathSegments, -1);
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
    let path = this.#rootText;
    for (const segment of this.#pathSegments) {
      if (segment.category === 'thenAccessProperty') {
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
