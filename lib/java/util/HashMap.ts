/*
 * Copyright (c) 2012-2017 The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

import { java } from "../java";

import { HashSet } from "./HashSet";
import { HashMapEntry } from "./HashMapEntry";
import { HashMapKeyEqualityComparator } from "./HashMapKeyEqualityComparator";
import { MapKeyView } from "./MapKeyView";
import { MapValueView } from "./MapValueView";
import { HashMapValueEqualityComparator } from "./HashMapValueEqualityComparator";

/**
 * This implementation was taken from the ANTLR4 Array2DHashMap implementation and adjusted to fulfill the
 * more general Java HashMap implementation.
 */
export class HashMap<K, V> implements java.lang.Cloneable<HashMap<K, V>>, java.io.Serializable, java.util.Map<K, V> {

    // eslint-disable-next-line @typescript-eslint/naming-convention
    private HashSetBackingStore = class extends HashSet<HashMapEntry<K, V>> {
        public constructor(initialCapacity?: number, loadFactor?: number) {
            super(initialCapacity, loadFactor);

            this.comparator = new HashMapKeyEqualityComparator();
        }
    };

    private backingStore: HashSet<HashMapEntry<K, V>>;

    public constructor(initialCapacity?: number, loadFactor?: number);
    public constructor(map: java.util.Map<K, V>);
    public constructor(initialCapacityOrMap?: number | java.util.Map<K, V>, loadFactor?: number) {
        if (typeof initialCapacityOrMap === "number") {
            this.backingStore = new this.HashSetBackingStore(initialCapacityOrMap, loadFactor);
        } else {
            this.backingStore = new this.HashSetBackingStore();
            if (initialCapacityOrMap) {
                this.putAll(initialCapacityOrMap);
            }
        }
    }

    public *[Symbol.iterator](): IterableIterator<java.util.Map.Entry<K, V>> {
        yield* this.backingStore.toArray();
    }

    public clear(): void {
        this.backingStore.clear();
    }

    public clone(): HashMap<K, V> {
        return new HashMap<K, V>(this);
    }

    public containsKey(key: K): boolean {
        const entry = new HashMapEntry<K, V>(key, null);

        return this.backingStore.contains(entry);
    }

    public containsValue(value: V): boolean {
        const comparator = new HashMapValueEqualityComparator<K, V>();
        const entry = new HashMapEntry<K, V>(null, value);
        for (const e of this) {
            if (comparator.equals(e as HashMapEntry<K, V>, entry)) {
                return true;
            }
        }

        return false;
    }

    public entrySet(): java.util.Set<java.util.Map.Entry<K, V>> {
        return this.backingStore;
    }

    public get(key: K): V | undefined {
        const entry = new HashMapEntry<K, V>(key, null);
        const bucket = this.backingStore.find(entry);
        if (!bucket) {
            return undefined;
        }

        return bucket.getValue();
    }

    public isEmpty(): boolean {
        return this.backingStore.isEmpty();
    }

    public keySet(): java.util.Set<K> {
        return new MapKeyView<K, V>(this, new HashMapKeyEqualityComparator());
    }

    public put(key: K, value: V): V | undefined {
        const entry = new HashMapEntry(key, value);
        const element = this.backingStore.find(entry);
        let result: V | undefined;
        if (!element) {
            this.backingStore.add(entry);
        } else {
            result = element.setValue(value);
        }

        return result;
    }

    public putAll(map: java.util.Map<K, V>): void {
        if (map instanceof HashMap) {
            this.backingStore.addAll(map.backingStore);
        } else {
            const entries = map.entrySet();
            for (const entry of entries) {
                this.backingStore.add(new HashMapEntry<K, V>(entry.getKey(), entry.getValue()));
            }
        }
    }

    public remove(key: K): V | undefined {
        const entry = new HashMapEntry<K, V>(key, null);

        const result = this.backingStore.find(entry);
        if (result) {
            this.backingStore.remove(result);

            return result.getValue();
        }

        return undefined;
    }

    public size(): number {
        return this.backingStore.size();
    }

    public hashCode(): number {
        return this.backingStore.hashCode();
    }

    public equals(o: unknown): boolean {
        if (!(o instanceof HashMap)) {
            return false;
        }

        return this.backingStore.equals(o.backingStore);
    }

    public values(): java.util.Collection<V> {
        return new MapValueView(this, new HashMapValueEqualityComparator());
    }
}
