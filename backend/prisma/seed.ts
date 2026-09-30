import {
  PrismaClient, VehicleType, FuelType,
  OrderPriority, OrderStatus, TimeWindowStatus,
  RouteStatus, RouteStopStatus, UserRole,
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SmartRoute database...");

  // ── 1. Users ────────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash("Password@123", 10);

  const admin = await prisma.user.upsert({
    where:  { email: "admin@smartroute.io" },
    update: { passwordHash: hash, role: UserRole.ADMIN },
    create: { email: "admin@smartroute.io", passwordHash: hash, role: UserRole.ADMIN },
  });
  const dispatcher = await prisma.user.upsert({
    where:  { email: "dispatcher@smartroute.io" },
    update: { passwordHash: hash, role: UserRole.DISPATCHER },
    create: { email: "dispatcher@smartroute.io", passwordHash: hash, role: UserRole.DISPATCHER },
  });
  const driverUser = await prisma.user.upsert({
    where:  { email: "driver@smartroute.io" },
    update: { passwordHash: hash, role: UserRole.DRIVER },
    create: { email: "driver@smartroute.io", passwordHash: hash, role: UserRole.DRIVER },
  });
  console.log(`✅ Users: ${admin.email}, ${dispatcher.email}, ${driverUser.email}`);

  // ── 2. Wipe old demo data ────────────────────────────────────────────────────
  await prisma.timeWindowViolation.deleteMany({});
  await prisma.eTAPrediction.deleteMany({});
  await prisma.routeStop.deleteMany({});
  await prisma.route.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.warehouse.deleteMany({});
  console.log("🧹 Cleared old data");

  // ── 3. Warehouses ───────────────────────────────────────────────────────────
  const warehousesData = [
    { name: "Warehouse 1 — Hyderabad (Gachibowli)", address: "Financial District, Nanakramguda, Gachibowli, Hyderabad, TS 500032", latitude: 17.4401, longitude: 78.3489 },
    { name: "Warehouse 2 — Kakinada (Port Road)",   address: "Commercial Port Road, Suryaraopeta, Kakinada, AP 533001",             latitude: 16.9891, longitude: 82.2475 },
    { name: "Warehouse 3 — Bengaluru (Whitefield)", address: "ITPL Main Road, EPIP Zone, Whitefield, Bengaluru, KA 560066",         latitude: 12.9698, longitude: 77.7499 },
    { name: "Warehouse 4 — Chennai (Guindy)",        address: "Industrial Estate, Guindy, Chennai, TN 600032",                      latitude: 13.0067, longitude: 80.2026 },
    { name: "Warehouse 5 — Kochi (Kakkanad)",        address: "Infopark Expressway, Kakkanad, Kochi, KL 682030",                    latitude: 10.0159, longitude: 76.3419 },
    { name: "Warehouse 6 — Vijayawada (Auto Nagar)", address: "100ft Road, Auto Nagar Industrial Area, Vijayawada, AP 520007",      latitude: 16.4971, longitude: 80.6811 },
    { name: "Warehouse 7 — Visakhapatnam (Gajuwaka)", address: "Steel Plant Road, Gajuwaka, Visakhapatnam, AP 530026",             latitude: 17.6868, longitude: 83.2185 },
  ];
  const warehouses = await Promise.all(warehousesData.map(w => prisma.warehouse.create({ data: w })));
  console.log(`✅ ${warehouses.length} Warehouses`);

  const hyd = warehouses[0]; // Hyderabad
  const kak = warehouses[1]; // Kakinada

  // ── 4. Vehicles ─────────────────────────────────────────────────────────────
  const vehiclesData = [
    { plateNumber: "TS-09-EV-1024", type: VehicleType.VAN,        capacityKg: 850,  fuelType: FuelType.ELECTRIC },
    { plateNumber: "TS-07-HD-4412", type: VehicleType.TRUCK,      capacityKg: 2400, fuelType: FuelType.DIESEL },
    { plateNumber: "AP-05-KK-8921", type: VehicleType.VAN,        capacityKg: 950,  fuelType: FuelType.CNG },
    { plateNumber: "KA-03-WF-3310", type: VehicleType.CAR,        capacityKg: 400,  fuelType: FuelType.PETROL },
    { plateNumber: "TN-09-CH-7788", type: VehicleType.VAN,        capacityKg: 1100, fuelType: FuelType.DIESEL },
    { plateNumber: "KL-07-KC-5566", type: VehicleType.MOTORCYCLE, capacityKg: 120,  fuelType: FuelType.ELECTRIC },
  ];
  const vehicles = await Promise.all(vehiclesData.map(v => prisma.vehicle.create({ data: v })));
  console.log(`✅ ${vehicles.length} Vehicles`);

  // ── 5. Drivers ──────────────────────────────────────────────────────────────
  const driversData = [
    { name: "Suresh Reddy",    phone: "+91 98480 12345", licenseNumber: "TS-09-2018004123", vehicleId: vehicles[0].id, userId: driverUser.id },
    { name: "Ramesh Varma",    phone: "+91 94401 67890", licenseNumber: "AP-05-2019008741", vehicleId: vehicles[2].id },
    { name: "Ananya Rao",      phone: "+91 97000 54321", licenseNumber: "KA-03-2021003412", vehicleId: vehicles[3].id },
    { name: "Karthik Kumar",   phone: "+91 98840 98765", licenseNumber: "TN-09-2017006543", vehicleId: vehicles[4].id },
    { name: "Sai Praneeth",    phone: "+91 99890 23456", licenseNumber: "TS-07-2020009812", vehicleId: vehicles[1].id },
    { name: "Venkatesh Naidu", phone: "+91 98660 76543", licenseNumber: "AP-16-2022001122", vehicleId: vehicles[5].id },
  ];
  const drivers = await Promise.all(driversData.map(d => prisma.driver.create({ data: d })));
  console.log(`✅ ${drivers.length} Drivers (Suresh ↔ driver@smartroute.io)`);

  const now = new Date();
  const ph  = (h: number) => new Date(now.getTime() + h * 3_600_000);
  const mh  = (h: number) => new Date(now.getTime() - h * 3_600_000);

  // ── 6. PENDING orders — Hyderabad (for dispatcher to optimize) ──────────────
  const pendingHydOrders = [
    {
      customerName: "MedLife Pharmacy — Kondapur",
      address: "Plot 18, Kondapur Main Road, Near IKEA, Hyderabad",
      latitude: 17.4600, longitude: 78.3520,
      priority: OrderPriority.HIGH, weightKg: 12.5,
      earliestDelivery: ph(0), latestDelivery: ph(3),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.AT_RISK,
      warehouseId: hyd.id,
    },
    {
      customerName: "Sai Electronics — Ameerpet",
      address: "6-3-349, Ameerpet Metro Station Road, Hyderabad",
      latitude: 17.4375, longitude: 78.4483,
      priority: OrderPriority.MEDIUM, weightKg: 32.0,
      earliestDelivery: ph(1), latestDelivery: ph(6),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
    {
      customerName: "Krishna Sweets — Banjara Hills",
      address: "Road No 12, Banjara Hills, Hyderabad",
      latitude: 17.4239, longitude: 78.4388,
      priority: OrderPriority.LOW, weightKg: 18.0,
      earliestDelivery: ph(2), latestDelivery: ph(8),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
    {
      customerName: "Dr. Arvind Swamy — Apollo Clinic",
      address: "Plot 42, Hitech City Main Rd, Madhapur, Hyderabad",
      latitude: 17.4504, longitude: 78.3808,
      priority: OrderPriority.HIGH, weightKg: 28.5,
      earliestDelivery: mh(0.5), latestDelivery: ph(2),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.AT_RISK,
      warehouseId: hyd.id,
    },
    {
      customerName: "Lakshmi Narayana — BioTech Labs",
      address: "Genome Valley, Shamirpet, Hyderabad",
      latitude: 17.6184, longitude: 78.5833,
      priority: OrderPriority.MEDIUM, weightKg: 20.0,
      earliestDelivery: ph(1), latestDelivery: ph(6),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
    {
      customerName: "Srikanth M. — Retail Hub",
      address: "Shop 12, Forum Sujana Mall, Kukatpally, Hyderabad",
      latitude: 17.4842, longitude: 78.3888,
      priority: OrderPriority.MEDIUM, weightKg: 42.0,
      earliestDelivery: ph(1), latestDelivery: ph(5),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
  ];

  const pendingHyd = await Promise.all(pendingHydOrders.map(o => prisma.order.create({ data: o })));
  console.log(`✅ ${pendingHyd.length} PENDING orders (Hyderabad) — ready for optimization`);

  // ── 7. PENDING orders — Kakinada ────────────────────────────────────────────
  const pendingKakOrders = [
    {
      customerName: "Coastal Fish Traders — Kakinada Port",
      address: "Fish Auction Hall, Harbour Road, Kakinada",
      latitude: 16.9745, longitude: 82.2612,
      priority: OrderPriority.HIGH, weightKg: 75.0,
      earliestDelivery: ph(0), latestDelivery: ph(4),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kak.id,
    },
    {
      customerName: "Rajiv Gandhi Medical College",
      address: "NH-16 Bypass Road, Undi, Near Kakinada",
      latitude: 16.9123, longitude: 82.2145,
      priority: OrderPriority.HIGH, weightKg: 9.5,
      earliestDelivery: ph(1), latestDelivery: ph(3),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kak.id,
    },
    {
      customerName: "Bhavani Silks & Textiles",
      address: "Main Road, Cinema Hall Area, Kakinada",
      latitude: 16.9604, longitude: 82.2382,
      priority: OrderPriority.LOW, weightKg: 22.0,
      earliestDelivery: ph(2), latestDelivery: ph(6),
      status: OrderStatus.PENDING, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kak.id,
    },
  ];
  const pendingKak = await Promise.all(pendingKakOrders.map(o => prisma.order.create({ data: o })));
  console.log(`✅ ${pendingKak.length} PENDING orders (Kakinada)`);

  // ── 8. ASSIGNED orders that are part of Suresh's active route ───────────────
  const sureshAssignedOrders = [
    {
      customerName: "Pooja Hegde — Tech Solutions",
      address: "Tower 3, Cyber Gateway, HITEC City, Hyderabad",
      latitude: 17.4478, longitude: 78.3762,
      priority: OrderPriority.HIGH, weightKg: 15.0,
      earliestDelivery: mh(1.5), latestDelivery: ph(2),
      status: OrderStatus.ASSIGNED, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
    {
      customerName: "Venkata Raman — MedPlus Pharmacy",
      address: "Road No 36, Jubilee Hills, Hyderabad",
      latitude: 17.4319, longitude: 78.4073,
      priority: OrderPriority.LOW, weightKg: 18.0,
      earliestDelivery: mh(1), latestDelivery: ph(4),
      status: OrderStatus.ASSIGNED, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
    {
      customerName: "Murali Krishna — Fresh Mart",
      address: "Near DLF Cybercity, Gachibowli, Hyderabad",
      latitude: 17.4452, longitude: 78.3582,
      priority: OrderPriority.HIGH, weightKg: 35.0,
      earliestDelivery: mh(2), latestDelivery: ph(1),
      status: OrderStatus.DELIVERED, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
    {
      customerName: "Subba Rao — Kakinada Agro",
      address: "Beach Road, NFCL Township, Kakinada",
      latitude: 16.9950, longitude: 82.2560,
      priority: OrderPriority.HIGH, weightKg: 45.0,
      earliestDelivery: mh(1), latestDelivery: ph(2),
      status: OrderStatus.ASSIGNED, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
  ];
  const sureshOrders = await Promise.all(sureshAssignedOrders.map(o => prisma.order.create({ data: o })));

  // ── 9. Ramesh ASSIGNED orders ────────────────────────────────────────────────
  const rameshOrders = await Promise.all([
    {
      customerName: "K. Satyanarayana — Port Logistics",
      address: "Anchorage Road, Jagannaickpur, Kakinada",
      latitude: 16.9420, longitude: 82.2340,
      priority: OrderPriority.MEDIUM, weightKg: 80.0,
      earliestDelivery: ph(1), latestDelivery: ph(4),
      status: OrderStatus.ASSIGNED, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kak.id,
    },
    {
      customerName: "Subba Rao — NFCL Township",
      address: "Beach Road, NFCL Township, Kakinada",
      latitude: 16.9950, longitude: 82.2560,
      priority: OrderPriority.HIGH, weightKg: 45.0,
      earliestDelivery: mh(1), latestDelivery: ph(2),
      status: OrderStatus.ASSIGNED, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kak.id,
    },
  ].map(o => prisma.order.create({ data: o })));

  console.log("✅ Suresh & Ramesh ASSIGNED/DELIVERED orders created");

  // ── 10. Suresh's IN_PROGRESS route ──────────────────────────────────────────
  const sureshRoute = await prisma.route.create({
    data: {
      driverId:             drivers[0].id,
      vehicleId:            vehicles[0].id,
      warehouseId:          hyd.id,
      status:               RouteStatus.IN_PROGRESS,
      totalDistanceKm:      26.4,
      estimatedDurationMin: 68,
      plannedDepartureAt:   mh(1),
      actualDepartureAt:    mh(0.75),
    },
  });

  const sureshStops = [
    { orderId: sureshOrders[2].id, seq: 1, status: RouteStopStatus.COMPLETED, arrival: mh(0.5), actual: mh(0.2) },
    { orderId: sureshOrders[0].id, seq: 2, status: RouteStopStatus.PENDING,   arrival: ph(0.3), actual: null    },
    { orderId: sureshOrders[1].id, seq: 3, status: RouteStopStatus.PENDING,   arrival: ph(0.7), actual: null    },
    { orderId: sureshOrders[3].id, seq: 4, status: RouteStopStatus.PENDING,   arrival: ph(1.1), actual: null    },
  ];

  for (const s of sureshStops) {
    await prisma.routeStop.create({
      data: {
        routeId:         sureshRoute.id,
        orderId:         s.orderId,
        stopSequence:    s.seq,
        status:          s.status,
        projectedArrival: s.arrival,
        actualArrival:   s.actual,
      },
    });
  }

  // ── 11. Ramesh's PLANNED route ───────────────────────────────────────────────
  const rameshRoute = await prisma.route.create({
    data: {
      driverId:             drivers[1].id,
      vehicleId:            vehicles[2].id,
      warehouseId:          kak.id,
      status:               RouteStatus.PLANNED,
      totalDistanceKm:      18.2,
      estimatedDurationMin: 45,
      plannedDepartureAt:   ph(0.5),
    },
  });

  for (let i = 0; i < rameshOrders.length; i++) {
    await prisma.routeStop.create({
      data: {
        routeId:         rameshRoute.id,
        orderId:         rameshOrders[i].id,
        stopSequence:    i + 1,
        status:          RouteStopStatus.PENDING,
        projectedArrival: ph(0.5 + (i + 1) * 0.4),
      },
    });
  }

  // ── 12. Karthik's COMPLETED route (history) ──────────────────────────────────
  const karthikOrdersData = [
    {
      customerName: "Hotel Taj Deccan — Room Service",
      address: "Banjara Hills Road No 1, Hyderabad",
      latitude: 17.4231, longitude: 78.4430,
      priority: OrderPriority.HIGH, weightKg: 8.0,
      status: OrderStatus.DELIVERED, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
    {
      customerName: "Manjeera Mall — Stock Delivery",
      address: "Kukatpally Housing Board, Hyderabad",
      latitude: 17.4949, longitude: 78.3927,
      priority: OrderPriority.MEDIUM, weightKg: 55.0,
      status: OrderStatus.DELIVERED, timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hyd.id,
    },
  ];
  const karthikOrders = await Promise.all(karthikOrdersData.map(o => prisma.order.create({ data: o })));

  const karthikRoute = await prisma.route.create({
    data: {
      driverId:             drivers[3].id,
      vehicleId:            vehicles[4].id,
      warehouseId:          hyd.id,
      status:               RouteStatus.COMPLETED,
      totalDistanceKm:      14.8,
      estimatedDurationMin: 38,
      plannedDepartureAt:   mh(3),
      actualDepartureAt:    mh(2.9),
      completedAt:          mh(1),
    },
  });
  for (let i = 0; i < karthikOrders.length; i++) {
    await prisma.routeStop.create({
      data: {
        routeId:         karthikRoute.id,
        orderId:         karthikOrders[i].id,
        stopSequence:    i + 1,
        status:          RouteStopStatus.COMPLETED,
        projectedArrival: mh(2.5 - i * 0.4),
        actualArrival:    mh(2.6 - i * 0.4),
      },
    });
  }

  console.log("✅ Suresh (IN_PROGRESS), Ramesh (PLANNED), Karthik (COMPLETED) routes seeded");
  console.log(`\n🎉 Seeding complete!
  
  Demo Logins:
    dispatcher@smartroute.io / Password@123  → Dispatcher Dashboard
    admin@smartroute.io      / Password@123  → Admin Dashboard

  Demo Data:
    ${pendingHyd.length + pendingKak.length} PENDING orders (ready to optimize)
    Suresh Reddy  — IN_PROGRESS route with 4 stops (1 completed, 3 remaining)
    Ramesh Varma  — PLANNED route ready to dispatch (Kakinada)
    Karthik Kumar — COMPLETED route (historical record)
  `);
}

main()
  .catch((e) => { console.error("❌ Seed error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
