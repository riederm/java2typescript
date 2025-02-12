/*
 * This file is released under the MIT license.
 * Copyright (c) 2022, Mike Lischke
 *
 * See LICENSE-MIT.txt file for more info.
 */

import { MurmurHash } from "../../MurmurHash";
import { IEquatable } from "../../types";
import { java } from "../java";

export class HashMapEntry<K, V> implements java.util.Map.Entry<K, V>, IEquatable {
    private computedHash: number | undefined;

    public constructor(private key: K | null, private value: V | null) {
    }

    public equals(o: unknown): boolean {
        if (!(o instanceof HashMapEntry)) {
            return false;
        }

        let keysEqual = false;
        if (this.key === null) {
            if (o.key === null) {
                keysEqual = true;
            }
        } else if (o.key !== null) {
            keysEqual = MurmurHash.valueHash(this.key) === MurmurHash.valueHash(o.key);
        }

        let valuesEqual = false;
        if (this.value === null) {
            if (o.value === null) {
                valuesEqual = true;
            }
        } else if (o.value !== null) {
            valuesEqual = MurmurHash.valueHash(this.value) === MurmurHash.valueHash(o.value);
        }

        return keysEqual && valuesEqual;
    }

    public getKey(): K {
        return this.key;
    }

    public getValue(): V {
        return this.value;
    }

    public hashCode(): number {
        if (this.computedHash === undefined) {
            this.computedHash = (this.key === null ? 0 : MurmurHash.valueHash(this.key))
                ^ (this.value === null ? 0 : MurmurHash.valueHash(this.value));
        }

        return this.computedHash;
    }

    public setValue(value: V): V {
        const temp = this.value;
        this.value = value;
        this.computedHash = undefined;

        return temp;
    }
}

