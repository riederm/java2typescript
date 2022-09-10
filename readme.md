[![CircleCI](https://circleci.com/gh/mike-lischke/java2typescript/tree/master.svg?style=svg)](https://circleci.com/gh/mike-lischke/java2typescript/tree/master)

# **java2typescript**
A Node.js tool for converting Java source packages to Typescript

With this tool it is possible to do the major work of converting Java code to Typescript. Of course a lot of manual work remains after the conversion run, but at least all the tedious standard changes (like exchanging variable name and its type) is done automatically.

The tool uses (a copy of) the [Java grammar from the ANTLR4 grammar directory](https://github.com/antlr/grammars-v4/tree/master/java/java), which supports Java 17. The converter, however, only supports language features up to Java 11.

# Abstract

Conversion from one programming language to another is usually a pretty big task and every help to automate that task is welcome. Some language combinations produce extra work, if their syntax is too different, however Java and Typescript (the typed variant of Javascript) are so close that a conversion is relatively easy.

The other side of the equation is what infrastructure the source code uses (SDK, third party libraries etc.) and how to represent that in the target language. And after having this tool doing the main work from a syntactic stand point, this is probably what produces most of the remaining work. In order to help with that the tool comes with shims for certain Java SDK classes. These are usually not complete, but grow in completeness the more of a class/interface is needed. At least this allows for an iterative approach when doing a conversion.

Also helpful for an iterative approach is that a conversion process usually takes only a very small amount of time, in the range of seconds, depending on the project size and how fast the file system is (enumeration, file loading, file writing).

# What's Possible and What's Not

It's practically never the case that two languages have the same semantic concepts everywhere and so is it with Java and Typescript, even though they are so close that much of the code can directly be taken over (after proper symbol resolution). Yet there are aspects to consider:

- Java interfaces are probably the most incompatible objects between the two languages. Java interfaces can have initialized fields and method implementations, which is not possible in Typescript. Hence all interfaces are converted to abstract TS classes. Fortunately, TS allows that a class `implements` another class, not only an interface. Using `implements` is however not always a good solution (especially when referencing symbols from the base class). An effort is made to use `extends` in simple cases (no existing `extends` clause and only one type for the `implements` clause) instead. Using `extends` for all classes in general is not possible, as that might lead to multiple inheritance, which is not supported by TS/JS.
- Enums in Java are objects with compiler synthesized methods, which can only partially mapped to TS enums. Only the enum constants can be taken over and only those that are not functions. Any other enum construct must be fixed manually.
- Another incompatible concept are iterators. Some iterator classes exist in the JDK shims (e.g. `ListIterator`), but those don't work in native JS/TS `for` loops. Therefore the native TS iterator is implemented instead. This requires manual updates where such iterators are used.
- The tool supports constructor and method overloading, up to the point what's allowed in Typescript.
    - That excludes the mix of static and non-static overloaded methods and generic methods with different type parameter lists.
    - All overloaded methods must have the same visibility (public/protected/private).
    - Overloaded methods which override inherited methods won't work out of the box and need manual changes.
- Java has no concept of optional fields and parameters. This makes it difficult to tell if a parameter is allowed to be undefined. This must be handled manually on a case-by-case basis.
- Default parameters are implemented in Java by using method overloading.
- Typescript does not support multi-dimensional array creation with array sizes (initializers are supported however). That means constructs like `new String[1][2][4]` can only be converted to TS without initial sizes: `= [[[]]]`. This might require manual changes in the code that uses such an array, if it relies on a specific size of an array (by explicitly setting an array member, instead of pushing values to it).
- Java automatically converts between `long` and other integer type. TS uses `bigint` for 64 bit integer types and the `n` suffix for bigint literals. In Java these integer types can freely be mixed, but TS will complain if one tries to, say, shift a bigint using a standard number literal. This must be solved manually.
- Annotations usually cannot be converted, except for a very few (like @final), which are then converted using decorators. The current implementation is however very basic. Don't expect much of that.
- Generic constructors are not possible in Typescript. This must be solved manually.
- Reflection is partially supported, by implementing `getClass()` and `.class` accessors. The package java.lang.reflect is not supported, however.
- TS regular expressions do not support all features from Java regex, specifically these flags are not supported:
    - Pattern.CANON_EQ
    - Pattern.COMMENTS
    - Pattern.LITERAL
    - Pattern.UNIX_LINES.
- The try-with-resources statement is supported. See the Exception Handling section for details.
- Java supports automatic (un)boxing of built-in types (for example `Integer <-> int`). This behavior is not transformed to TS, so some manual work is required to make the conversion explicit.
- Java class initializers are handled properly. However, static initializers require ECMA 2022 and non-static initializers are converted to a parameter-less constructor (which might then be merged with other constructor code if that creates a constructor overloading situation).
- The java `char` type is defined as the type alias `CodePoint`, which represents a single numeric value in the Unicode range 0..0x1FFFF. Arrays of chars are transformed to `Uint32Array`.
- Rest parameters are supported but need manual resolution in overloading scenarios, because the implementation signature becomes just a single rest parameter (which can represent any of the overload parameters).

There are also certain things to consider for nested types. See below for more details.

The converter avoids extending existing classes (like `String`), which means certain functionality must be provided by other classes. For instance `String.format` is converted to `util.format` (with no support for a locale).

# Containers and Equality

Containers (every class implementing `java.util.Set` and `java.util.Map`) require special attention. In Java these classes use **Object Equality** to locate elements. This approach not only compares objects by reference, but also uses their `equals()` method to compare them (together with their `hashCode()` method). This cannot only lead to deep comparisons, but also to equality of different instances, if they contain the same values. Object equality is achieved by comparing value hash codes. Such values can only be equal if they have the same hash code.

In contrast, there's the so-called **Identity Equality** (aka **Reference Equality**). This approach is defined by considering two objects being equal only, if their memory reference is the same. There are special containers implementing exactly this behavior (like java.util.IdentityHashMap).

In JS/TS the second approach is used by all containers and an extra effort is required to add support for object equality. However, even though the `equals()` method is supported and used by all Java objects, the default behavior of this method is to compare only references. So, even if object equality is supported by default, it doesn't always mean, it's also in actual use. Only if keys and values implement the `equals()` (and consequently `hashCode()`) method, then object equality is actually used.

In addition to these considerations there's the fact that primitive types are always compared by value (both in Java and JS/TS). Number, bigint, string, boolean and the special values `undefined` and `NaN` fall under this category. So they neither need to implement an `equals` method nor can they be compared by reference. Side note: null and symbol are also marked as primitive type in JS/TS, but `null` is not really a primitive and `symbol` is not used in converted Java code.

As a consequence of that it's very important to select the right JS/TS container replacement for a Java container. The SDK shims contain implementations for HashMap and HashSet, which follow the object equality semantic, and IdentityHashMap (using reference equality).

# Nested Classes and Interfaces

Nested classes and types are converted to local classes in Typescript by using either a class expression (for static nested classes) or class factory methods (for non-static nested classes). This concept allows non-static inner classes to access all members of the outer class (including private ones) and supports inheritance between local classes (and external use anyhow).

To allow use of such local classes as a type, a namespace declaration is automatically added at the end of the generated file.

# Explicit Constructor Invocation

Explicit constructor invocation (also known as constructor chaining) is a concept where one constructor can call another constructor in the same class, by using the function call `this()`. In Typescript this concept is represented by converting all constructors to a single implementation (like for any overloaded method), but additionally the generated body is placed into a local closure, which allows to call itself recursively, emulating so the chaining.

While this implementation works well, there are a few issues with it:

- Initialization of read-only class members cause a Typescript error, because the initialization happens now in the mentioned closure and not directly in the constructor body. These errors must be manually suppressed by placing a `// @ts-ignore` (or `@ts-expect-error`) line directly before each assignment line.
- Typescript considers `super()` calls, which are not directly executed in the constructor body as error. Additionally, such calls are not counted when Typescript (and ESlint) check for an existing `super()` call for derived classes. All these 3 errors must be suppressed as well. The tool will automatically insert TS suppression lines, if the `suppressTSErrorsForECI` option is set. Though this might hide other errors too, which is why the automatic insertion is optional. The ESlint errors are always suppressed as they rather have informational character and are for very specific problems (not like the TS suppression).

Here's a real world example of the final form of a constructor, which uses overloading and initializes read-only members:

```typescript
    /* eslint-disable constructor-super, @typescript-eslint/no-unsafe-call */
    public constructor(a: SingletonPredictionContext);
    public constructor(parents: PredictionContext[], returnStates: number[]);
    /* @ts-expect-error, because of the super() call in the closure. */
    public constructor(aOrParents: SingletonPredictionContext | PredictionContext[], returnStates?: number[]) {
        const $this = (aOrParents: SingletonPredictionContext | PredictionContext[], returnStates?: number[]): void => {
            if (aOrParents instanceof SingletonPredictionContext && returnStates === undefined) {
                const a = aOrParents;
                $this([a.parent], [a.returnState]);
            } else {
                const parents = aOrParents as PredictionContext[];
                /* @ts-expect-error, because of the super() call in the closure. */
                super(PredictionContext.calculateHashCode(parents, returnStates));
                /* @ts-ignore */
                this.parents = parents;
                /* @ts-ignore */
                this.returnStates = returnStates;
            }
        };

        $this(aOrParents, returnStates);

    }
    /* eslint-enable constructor-super, @typescript-eslint/no-unsafe-call */
```

# Exception Handling

The converter tries to preserve as much of Java's exception semantics as possible, even at the price of higher code complexity. However, there are certain limits.

Usually, the message of an exception (unless explicitly specified in the converted code) is not what the JDK is using, especially for exceptions originating in native code (e.g. file APIs). At a later point in time, someone might take the burden and extract the correct error messages from the JDK source code.

The `Throwable` implementation parses the stacktrace in a JS/TS error object to find the individual stack elements (`StackTraceElement`). However, that's not exactly what's available in Java (but close). This class also helps to implement the semantic of suppressed exceptions, but because that's automatic in Java, though not in JS/TS, this works only in certain circumstances (namely try-with-resource statements, see next paragraph). To recap: exceptions thrown in a try block are not visible when the finally block also throws an exception. In Java the exceptions from the try block are added as suppressed exceptions to the exception thrown in the finally block. In JS/TS these exceptions are lost, however.

Java 8 and higher support a construct which ensures that certain resources are automatically closed, regardless of errors. For this the try/catch/finally statement supports an additional expression between the `try` keyword and the opening curly brace. Any object that implements the AutoCloseable interface is automatically closed when the try block finished execution (with or w/o errors). To emulate this behavior additional try blocks are inserted, which handle exceptions in the same way as Java does.

# Conversion Process

The conversion process tries hard to keep all whitespaces + comments in place. However, when code must be reordered or generated, this can lead to misformatted target code. Also no conversion is done for tabs. A good linter and/or prettifier is recommended to fix this easily.

Starting a conversion requires a number of things. Everything is kicked off by creating an instance of the `JavaToTypescriptConverter` class, providing a configuration object, and calling `startConversion` of that instance:

```typescript
const convertMyPackage = async () => {
    const configuration: IConverterConfiguration = {
        ...
    };

    const converter = new JavaToTypescriptConverter(configuration);
    await converter.startConversion();
};

await convertMyPackage();
```

It's best to specify all source paths as absolute paths, in order to avoid trouble with relative path construction. Library + target paths can be relative, however.

The folder structure of a Java project/package is recreated in the target folder, which helps to locate the generated files more easily.

To support iterative conversions (running the tool several times with the same settings) without overwriting good files (e.g. when you have fixed errors in a file) add a line `/* java2ts: keep */` as the first line in such a file. This is checked by the tool and the file is then not be changed. The console output will change, to indicate that a file is kept instead of re-generated.

# Symbol Resolution and Import Resolvers

In opposition to Java all symbols in Typescript must use the fully qualified identifier form (e.g. `this.` for class/interface members, `ClassName.` for static members etc.). This requires to resolve every symbol (types, variable names etc.). The converter resolves symbols according to this model:

- The current file (local variables, parameters, normal and static class members, in this order).
- Any of the extended or implemented classes/interfaces (public and protected normal and static class members), in the order they are specified in the Java code.
- Any of the files in the current project/package (only exported classes/interfaces), in the order they are found while enumerating the files on disk.
- Module mappings (exported classes/interfaces from a 3rd party package), in the order they are given.
- Import resolvers.

If a symbol cannot be resolved then the original text is used and the user has to fix it manually.

> Note: The symbol resolution process does not handle symbol shadowing (for example a local variable with the same name as a method in the class), which is bad style anyway. This situation must be solved manually.

Import resolvers are the last resort to get symbols automatically resolved if nothing else works. There is one predefined resolver in the project: for the Java SDK. See the [separate readme](lib/java/readme.md) for details, how to work with and extend the Java SDK shims.

The converter uses so-called package sources for keeping symbol information per file. There are 2 types of package sources:

- For source code Java files.
- For packages without source code.

A file package source is automatically created for each of the Java files in the current package (and each of the 3rd party source files, if specified in the source mapping configuration field). The package source parses the file and creates a symbol table from the generated parse tree. This symbol table is then used to resolve symbols. A package source also knows where to find the source files, to properly create relative import paths in the generated files.

An import resolver function maps a package ID to a package source it creates:

```typescript
const importResolver = (packageId: string): PackageSource[] => {
    const result: PackageSource[] = [];

    knownSDKPackages.forEach((value) => {
        if (packageId.startsWith(value)) {
            result.push(PackageSourceManager.emptySource(value));
        }
    });

    return result;
};
```

In this example the resolver creates empty sources for each known Java SDK package (which could not be resolved otherwise). An empty source has an empty symbol table and can hence not resolve symbols. So they serve rather as placeholders. If a package cannot be resolved `java2typescript` implicitly creates an empty source (and logs that in the console).

Normally you would, however, not create an empty source, but one that can deal with symbols and return fully qualified names. For an example how to do that check the `JavaPackageSource.ts` file, which manually creates a symbol table for all supported Java types, and holds the target path to the TS implementations (shims) for path resolution.
