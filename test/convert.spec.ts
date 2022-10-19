import { IConverterConfiguration, JavaToTypescriptConverter } from "../src/conversion/JavaToTypeScript";

describe("Convert", () => {
    fit("Base", async () => {
        const configuration: IConverterConfiguration = {
            // eslint-disable-next-line max-len
            packageRoot: "/mnt/c/git/communication.protocols/at.bachmann.ethercat/plugins/at.bachmann.ethercat.core/src",
            javaLib: "/home/mathias/projects/java2typescript/lib/java",
            output: "/tmp/transpile",
            options: {
                sourceMappings: [],
            },
        };

        const converter = new JavaToTypescriptConverter(configuration);
        await converter.startConversion();
    });
});
