/*
 * This file is released under the MIT license.
 * Copyright (c) 2021, 2022, Mike Lischke
 *
 * See LICENSE file for more info.
 */

import glob from "glob";
import path from "path";
import fs from "fs";

import { FileProcessor } from "./FileProcessor";
import { CustomImportResolver, PackageSourceManager } from "../PackageSourceManager";

/** A record for the class resolver map. */
export interface IClassResolver {
    alias?: string;
    importPath: string;
}

/**
 * Maps a root package ID to a source path to get the Java source code from, as well as a path that is used
 * for the imports. Source mappings are to provide symbol information for a package, which is however not converted.
 * For example the antlr4ts runtime is already done and available in a node module, but for symbol lookup we have
 * to parse the original Java files.
 */
export interface ISourceMapping {
    /** The full path to the file to parse. */
    sourcePath: string;

    /**
     * A path specifying the import. It's assumed to be a node module, if it doesn't start with
     * a slash or dot. Otherwise the import will be computed relative to the target file.
     */
    importPath: string;
}

export interface IConverterOptions {
    /** Anything to go before the first code line (e.g. linter settings). */
    prefix?: string;

    /** If true then Java annotations are converted to Typescript decorators. */
    convertAnnotations?: boolean;

    /**
     * A folder path for additional TS source files required to polyfill Java classes or which implement support code.
     */
    lib?: string;

    /** If true, functions/methods use the arrow syntax. */
    preferArrowFunctions?: boolean;

    /** If true the processor will automatically add braces in IF/ELSE/SWITCH statements, if they are missing. */
    autoAddBraces?: boolean;

    /**
     * For simpler imports index files can be added to each generated output folder, which export all files in that
     * folder plus the index files of all subfolders.
     */
    addIndexFiles?: boolean;

    /**
     * A mapping of a 3rd party package which is available in source form. Maps root package IDs (without any type
     * name) to a source path, which is then used as package root for that package.
     */
    sourceMappings?: ISourceMapping[];

    /**
     * A function that takes a package ID and returns a package source for it. Used usually to provide hard coded
     * symbol information for packages/modules for which no Java source code is available.
     */
    importResolver?: CustomImportResolver;

    /**
     * A map that provides an import string for a given class name. Names given here do not use qualifiers, but
     * are imported directly from the node module or file/folder given as resolution.
     * No file is parsed and no symbol table is created for the symbols listed here.
     */
    classResolver?: Map<string, IClassResolver>;

    /**
     * Indicates if the code generator should add @ts-expect-error comments to suppress reported errors caused
     * by the conversion of explicit constructor invocation expressions to a closure.
     */
    suppressTSErrorsForECI?: boolean;
}

/** Options used for debugging the transformation process. */
export interface IDebugOptions {
    /**
     *  Specifies a position in a file whose name matches filePattern. The parse tree located covering this position
     * is searched after parsing and the entire parse tree path from the root up to this tree is printed to the console.
     */
    pathForPosition?: {
        filePattern?: string | RegExp;
        position: {
            row: number;    // One-based line number
            column: number;
        };
    };
}

export interface IConverterConfiguration {
    /**
     * The root folder of the package to convert. Only files in the file tree are automatically resolved
     * when importing symbols.
     * Package imports from outside (inclusive standard Java packages) need an explicit source resolver
     * (@link options.importResolver).
     *
     * Note: Only Java files are actually transformed.
     */
    packageRoot: string;

    /**
     * The absolute path to the Java SDK polyfills root folder.
     */
    javaLib: string;

    /**
     * An optional inclusion filter for files found in the package. Only files matching this pattern are actually
     * processed and output generated. However, non-Java files are ignored, even if they are included here.
     *
     * Note: All Java files in the package have to be loaded once to get their symbols.
     *       However, they are only parsed if something is actually imported from them, saving so some parsing time.
     */
    include?: Array<string | RegExp>;

    /**
     * Files to exclude from the conversion process.
     */
    exclude?: Array<string | RegExp>;

    /**
     * The root folder for generated files. Relative paths are kept (like in the source tree).
     */
    output: string;

    /**
     * Options for the conversion process.
     */
    options: IConverterOptions;

    /**
     * Additional options for debugging the conversion process.
     */
    debug?: IDebugOptions;
}

export class JavaToTypescriptConverter {
    public constructor(private configuration: IConverterConfiguration) {
        PackageSourceManager.configure(configuration.options.importResolver, configuration.javaLib);
    }

    public async startConversion(): Promise<void> {
        const currentDir = process.cwd();

        // Only the files in this list are converted.
        const toConvert: FileProcessor[] = [];

        // Start off by creating java file source instances for each file in the package root.
        const fileList = glob.sync(this.configuration.packageRoot + "/**/*.java");
        if (fileList.length === 0) {
            console.error("The specified pattern/path does not return any file");

            return;
        }

        fs.mkdirSync(this.configuration.output, { recursive: true });

        console.log(`\nFound ${fileList.length} java files in ${this.configuration.packageRoot}`);
        const root = this.configuration.packageRoot;
        fileList.forEach((entry) => {
            const relativeSource = path.relative(this.configuration.packageRoot, entry);

            const tsName = relativeSource.substring(0, relativeSource.length - 4) + "ts";
            const target = this.configuration.output + "/" + tsName;

            const source = PackageSourceManager.fromFile(entry, path.resolve(currentDir, target), root);
            if (this.filterFile(entry, this.configuration.include, this.configuration.exclude)) {
                toConvert.push(new FileProcessor(source, this.configuration));
            }
        });

        // Load also all files given by a source mapping. These are never converted, however.
        for (const { sourcePath, importPath } of this.configuration.options.sourceMappings) {
            const list = glob.sync(sourcePath + "/**/*.java");
            console.log(`\nFound ${list.length} java files in ${sourcePath}`);
            list.forEach((entry) => {
                PackageSourceManager.fromFile(entry, importPath, sourcePath);
            });
        }

        console.log(`\nConverting ${toConvert.length} files...`);

        for await (const processor of toConvert) {
            await processor.convertFile();
        }

        if (this.configuration.options.addIndexFiles) {
            console.log("\nAdding index files...");
            this.addIndexFile(path.resolve(currentDir, this.configuration.output));
        }

        console.log("\nConversion finished");
    }

    /**
     * Check if the given file name matches any entry in the include and exclude filters.
     * If it matches one of the exclusion rules (if given) then the file is filtered out.
     * If the name matches any of the inclusion rules or no inclusion rules are given then the file is accepted.
     * Otherwise the file is filtered out.
     *
     * @param fileName The full path name.
     * @param include The inclusion rules.
     * @param exclude The exclusion rules.
     *
     * @returns True if the file is to be taken in, otherwise false.
     */
    private filterFile = (fileName: string, include?: Array<string | RegExp>,
        exclude?: Array<string | RegExp>): boolean => {
        if (exclude) {
            for (const filter of exclude) {
                if (fileName.match(filter)) {
                    return false;
                }
            }
        }

        if (include && include.length > 0) {
            for (const filter of include) {
                if (fileName.match(filter)) {
                    return true;
                }
            }

            return false;
        }

        return true;
    };

    private addIndexFile = (dir: string): void => {
        const dirList: string[] = [];
        const fileList: string[] = [];

        const entries = fs.readdirSync(dir, { encoding: "utf-8", withFileTypes: true });
        entries.forEach((entry) => {
            if (!entry.name.startsWith(".") && entry.name !== "index.ts") {
                if (entry.isDirectory()) {
                    dirList.push(`export * from "./${entry.name}";`);
                    this.addIndexFile(dir + "/" + entry.name);
                } else if (entry.isFile() && entry.name.endsWith(".ts")) {
                    fileList.push(`export * from "./${path.basename(entry.name, ".ts")}";`);
                }
            }
        });

        fs.writeFileSync(dir + "/index.ts",
            `// java2typescript: auto generated index file. Disable generation by setting the "addIndexFiles" ` +
            `option to false.\n${dirList.join("\n")}\n${dirList.length > 0 ? "\n" : ""}` +
            `${fileList.join("\n")}\n`);
    };
}
