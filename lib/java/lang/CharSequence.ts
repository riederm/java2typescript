/*
 * This file is released under the MIT license.
 * Copyright (c) 2021, Mike Lischke
 *
 * See LICENSE-MIT.txt file for more info.
 */

import { CodePoint } from ".";

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface CharSequence {
    /** Returns the char value at the specified index. */
    charAt(index: number): CodePoint;

    /** Returns the length of this character sequence. */
    length(): number;

    /** Returns a new CharSequence that is a subsequence of this sequence. */
    subSequence(start: number, end: number): CharSequence;

    /** Returns a string containing the characters in this sequence in the same order as this sequence. */
    toString(): string;

    /** This API is not part of the Java CharSequence interface, but in CharBuffer. */
    array(): Uint32Array;
}
