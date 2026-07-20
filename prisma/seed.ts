import {
  PrismaClient,
  ProductStatus,
  OrderStatus,
  Role,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

type SeededProduct = Prisma.ProductGetPayload<{ include: { variants: true } }>;

async function main() {
  console.log('Seeding database...');

  // wipe in dependency order so re-seeding is safe during local dev
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);

  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: passwordHash,
      name: 'Admin User',
      role: Role.ADMIN,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      password: passwordHash,
      name: 'Demo Customer',
      role: Role.CUSTOMER,
    },
  });

  const customerCart = await prisma.cart.create({
    data: { userId: customer.id },
  });
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@example.com' },
  });
  await prisma.cart.create({ data: { userId: admin.id } });

  const electronics = await prisma.category.create({
    data: { name: 'Electronics', slug: 'electronics' },
  });
  const phones = await prisma.category.create({
    data: { name: 'Phones', slug: 'phones', parentId: electronics.id },
  });
  const audio = await prisma.category.create({
    data: { name: 'Audio', slug: 'audio', parentId: electronics.id },
  });
  const apparel = await prisma.category.create({
    data: { name: 'Apparel', slug: 'apparel' },
  });
  const tops = await prisma.category.create({
    data: { name: 'Tops', slug: 'tops', parentId: apparel.id },
  });

  const productsData: {
    name: string;
    slug: string;
    description: string;
    categoryId: string;
    variants: {
      sku: string;
      name: string;
      price: number;
      discountPrice?: number;
      stock: number;
    }[];
  }[] = [
    {
      name: 'NovaPhone X',
      slug: 'novaphone-x',
      description: 'Flagship smartphone with OLED display',
      categoryId: phones.id,
      variants: [
        { sku: 'NPX-128-BLK', name: '128GB Black', price: 799.0, stock: 25 },
        {
          sku: 'NPX-256-SLV',
          name: '256GB Silver',
          price: 899.0,
          discountPrice: 849.0,
          stock: 15,
        },
      ],
    },
    {
      name: 'NovaPhone Lite',
      slug: 'novaphone-lite',
      description: 'Compact phone for everyday use',
      categoryId: phones.id,
      variants: [
        {
          sku: 'NPL-64-BLU',
          name: '64GB Blue',
          price: 399.0,
          stock: 40,
        },
        {
          sku: 'NPL-128-GRN',
          name: '128GB Green',
          price: 449.0,
          stock: 30,
        },
      ],
    },
    {
      name: 'Pulse Wireless Headphones',
      slug: 'pulse-wireless-headphones',
      description: 'Noise-cancelling over-ear headphones',
      categoryId: audio.id,
      variants: [
        {
          sku: 'PWH-BLK',
          name: 'Matte Black',
          price: 199.0,
          discountPrice: 159.0,
          stock: 50,
        },
        {
          sku: 'PWH-WHT',
          name: 'Pearl White',
          price: 199.0,
          stock: 35,
        },
      ],
    },
    {
      name: 'Echo Buds',
      slug: 'echo-buds',
      description: 'True wireless earbuds with charging case',
      categoryId: audio.id,
      variants: [
        { sku: 'EB-STD', name: 'Standard', price: 89.0, stock: 80 },
        { sku: 'EB-PRO', name: 'Pro', price: 129.0, stock: 45 },
      ],
    },
    {
      name: 'Classic Tee',
      slug: 'classic-tee',
      description: 'Soft cotton crew-neck t-shirt',
      categoryId: tops.id,
      variants: [
        { sku: 'TEE-BLK-M', name: 'Black / M', price: 29.99, stock: 100 },
        { sku: 'TEE-BLK-L', name: 'Black / L', price: 29.99, stock: 80 },
        {
          sku: 'TEE-WHT-M',
          name: 'White / M',
          price: 29.99,
          discountPrice: 24.99,
          stock: 60,
        },
      ],
    },
    {
      name: 'Trail Hoodie',
      slug: 'trail-hoodie',
      description: 'Midweight fleece hoodie for outdoor wear',
      categoryId: tops.id,
      variants: [
        { sku: 'HD-GRY-M', name: 'Grey / M', price: 59.0, stock: 40 },
        { sku: 'HD-NVY-L', name: 'Navy / L', price: 59.0, stock: 35 },
      ],
    },
  ];

  const createdProducts: SeededProduct[] = [];
  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        status: ProductStatus.PUBLISHED,
        categoryId: p.categoryId,
        variants: {
          create: p.variants.map((v) => ({
            sku: v.sku,
            name: v.name,
            price: v.price,
            discountPrice: v.discountPrice,
            stock: v.stock,
          })),
        },
      },
      include: { variants: true },
    });
    createdProducts.push(product);
  }

  // draft product so admin list shows mixed statuses
  await prisma.product.create({
    data: {
      name: 'Upcoming Gadget',
      slug: 'upcoming-gadget',
      description: 'Not yet published',
      status: ProductStatus.DRAFT,
      categoryId: electronics.id,
      variants: {
        create: [{ sku: 'UG-001', name: 'Prototype', price: 999.0, stock: 0 }],
      },
    },
  });

  const tee = createdProducts.find((p) => p.slug === 'classic-tee')!;
  const headphones = createdProducts.find(
    (p) => p.slug === 'pulse-wireless-headphones',
  )!;
  const teeVariant = tee.variants[0];
  const headphoneVariant = headphones.variants[0];

  // leave an active cart for the demo customer
  await prisma.cartItem.createMany({
    data: [
      {
        cartId: customerCart.id,
        productVariantId: teeVariant.id,
        quantity: 2,
      },
      {
        cartId: customerCart.id,
        productVariantId: headphoneVariant.id,
        quantity: 1,
      },
    ],
  });

  // sample delivered order (enables review eligibility for classic-tee)
  const deliveredOrder = await prisma.order.create({
    data: {
      orderNumber: 'ORD-SEED-DELIVERED-001',
      userId: customer.id,
      status: OrderStatus.DELIVERED,
      total: tee.variants[1].price,
      items: {
        create: [
          {
            productId: tee.id,
            productVariantId: tee.variants[1].id,
            quantity: 1,
            priceAtPurchase: tee.variants[1].price,
          },
        ],
      },
    },
  });

  await prisma.review.create({
    data: {
      userId: customer.id,
      productId: tee.id,
      rating: 5,
      comment: 'Great fit and fabric.',
    },
  });

  // sample pending order for admin status-flow demos
  await prisma.order.create({
    data: {
      orderNumber: 'ORD-SEED-PENDING-002',
      userId: customer.id,
      status: OrderStatus.PENDING,
      total: headphoneVariant.discountPrice ?? headphoneVariant.price,
      items: {
        create: [
          {
            productId: headphones.id,
            productVariantId: headphoneVariant.id,
            quantity: 1,
            priceAtPurchase:
              headphoneVariant.discountPrice ?? headphoneVariant.price,
          },
        ],
      },
    },
  });

  console.log('Seed complete.');
  console.log('  admin:    admin@example.com / Password123!');
  console.log('  customer: customer@example.com / Password123!');
  console.log(`  products: ${createdProducts.length} published (+ 1 draft)`);
  console.log(
    `  orders:   ${deliveredOrder.orderNumber} (DELIVERED), ORD-SEED-PENDING-002 (PENDING)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
