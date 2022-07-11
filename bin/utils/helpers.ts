import path from 'path';
import fse from 'fs-extra';
import { atomField, addAnotherField } from './inquiries';
import { AtomName } from './types';

export const getAtomFields = async () => {
  const fields = [];

  while (true) {
    const field = await atomField();
    fields.push(field);
    const keep = await addAnotherField();

    if (!keep.more) {
      break;
    }
  }

  return fields;
};

export const addPrismaModel = async (name: string, fields: any[]) => {
  let model = `
model ${name} {
  id String @id @default(uuid())
`;

  fields.forEach((field) => {
    model += `  ${field.name} ${field.type}\n`;
  });

  model += '}';

  await fse.appendFile(path.join(process.cwd(), 'src/prisma/schema.prisma'), model, {
    encoding: 'utf-8',
  });
};

export const copySchemas = async (src: string, dest: string, fields: any[]) => {
  let content = await fse.readFile(path.join(src, 'schemas.ts'), { encoding: 'utf-8' });

  let schemas = '';

  fields.forEach((field) => {
    if (field.type === 'String' || field.type === 'DateTime') {
      schemas += `\t${field.name}: z.string(),\n`;
    } else if (field.type === 'Int' || field.type === 'Float') {
      schemas += `\t${field.name}: z.number(),\n`;
    } else if (field.type === 'Boolean') {
      schemas += `\t${field.name}: z.boolean(),\n`;
    }
  });

  schemas = schemas.slice(0, -1);
  content = content.replace('//_0', schemas);
  await fse.writeFile(path.join(dest, 'schemas.ts'), content, { encoding: 'utf-8' });
};

export const copyTypes = async (
  namePascalCase: string,
  src: string,
  dest: string,
  fields: any[]
) => {
  let content = await fse.readFile(path.join(src, 'types.ts'), { encoding: 'utf-8' });

  content = content.replace('Object', namePascalCase);

  let types = '';

  fields.forEach((field) => {
    if (field.type === 'String') {
      types += `\t${field.name}: string;\n`;
    } else if (field.type === 'Int' || field.type === 'Float') {
      types += `\t${field.name}: number;\n`;
    } else if (field.type === 'Boolean') {
      types += `\t${field.name}: boolean;\n`;
    } else if (field.type === 'DateTime') {
      types += `\t${field.name}: Date;\n`;
    }
  });

  types = types.slice(0, -1);
  content = content.replace('//_0', types);
  await fse.writeFile(path.join(dest, 'types.ts'), content, { encoding: 'utf-8' });
};

export const copyCrudAtom = async (name: AtomName, src: string, dest: string) => {
  // Get atom fields
  const fields = await getAtomFields();

  // List of promises
  const promises: Promise<void>[] = [
    addPrismaModel(name.pascalCase, fields),
    copySchemas(src, dest, fields),
    copyTypes(name.pascalCase, src, dest, fields),
  ];

  // Exact copy
  const exactCopy = ['index.ts', 'router.ts'];
  exactCopy.map(async (file) => {
    promises.push(fse.copy(path.join(src, file), path.join(dest, file)));
  });

  // Inexact copy
  const inexactCopy = ['controllers.ts', 'services.ts', 'middleware.ts'];
  inexactCopy.map(async (file) => {
    const general = await fse.readFile(path.join(src, file), {
      encoding: 'utf-8',
    });

    let content = general;

    content = content.replace(/_object/g, name.camelCase);
    content = content.replace(/_Object/g, name.pascalCase);

    promises.push(fse.writeFile(path.join(dest, file), content));
  });

  await Promise.all(promises);
};

export const copyBaseAtom = async (name: AtomName, src: string, dest: string) => {
  await fse.copy(src, dest);
};

export const addAtomRoute = (name: AtomName) => {
  const imp = `import ${name.camelCase}s from './${name.kebabCase}s';\n\nc`;
  const use = `router.use('/${name.kebabCase}s', ${name.camelCase}s);\n\ne`;
  const routerFilePath = path.join(process.cwd(), '/src/atoms/router.ts');

  let file = fse.readFileSync(routerFilePath, { encoding: 'utf-8' });

  file = file.replace(/\nc/, imp);
  file = file.replace(/\ne/, use);

  fse.writeFileSync(routerFilePath, file);
};
