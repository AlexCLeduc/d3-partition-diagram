import faker from "faker";

faker.seed(123);
faker.setLocale("en_CA");

faker.seed(123);
faker.setLocale("en_CA");

export interface RawNode {
  id: string;
  name: string;
  amount?: number;
  children?: Node[];
}

function generateNode(level: number, maxLevel: number): RawNode {
  const node: Node = {
    id: faker.datatype.uuid(),
    name: faker.name.findName(),
  };

  if (level < maxLevel) {
    const childrenCount = faker.datatype.number({ min: 1, max: 5 * level });
    node.children = Array.from({ length: childrenCount }, () =>
      generateNode(level + 1, maxLevel)
    );
  } else {
    node.amount = faker.datatype.number({ min: 1, max: 100 });
  }

  return node;
}

function generateHierarchy(): RawNode {
  const root: Node = {
    id: faker.datatype.uuid(),
    name: "Root",
    children: [],
  };

  const topLevelCount = faker.datatype.number({ min: 4, max: 10 });
  root.children = Array.from({ length: topLevelCount }, () =>
    generateNode(1, 4)
  );
  //example negative child,
  root.children.push({
    id: faker.datatype.uuid(),
    name: "Negative Example",
    children: [
      {
        id: faker.datatype.uuid(),
        name: "Negative Child",
        children: [
          {
            id: faker.datatype.uuid(),
            name: "Positive Grandchild",
            amount: 200,
          },
          {
            id: faker.datatype.uuid(),
            name: "Negative Grandchild",
            amount: -850,
          },
        ],
      },
    ],
  });

  return root;
}

export const data = generateHierarchy();
// console.log(JSON.stringify(hierarchy, null, 2));

window.data = data;
