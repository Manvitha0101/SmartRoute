import { PrismaClient, VehicleType, FuelType, OrderPriority, OrderStatus, TimeWindowStatus, RouteStatus, RouteStopStatus, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SmartRoute database...");

  // 1. Seed Users (Admin, Dispatcher, Driver)
  const passwordHash = await bcrypt.hash("Password@123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@smartroute.io" },
    update: { passwordHash, role: UserRole.ADMIN },
    create: {
      email: "admin@smartroute.io",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const dispatcher = await prisma.user.upsert({
    where: { email: "dispatcher@smartroute.io" },
    update: { passwordHash, role: UserRole.DISPATCHER },
    create: {
      email: "dispatcher@smartroute.io",
      passwordHash,
      role: UserRole.DISPATCHER,
    },
  });

  console.log(`✅ Users created/verified: ${admin.email}, ${dispatcher.email}`);

  // 2. Clear old demo data to ensure clean names
  await prisma.timeWindowViolation.deleteMany({});
  await prisma.eTAPrediction.deleteMany({});
  await prisma.routeStop.deleteMany({});
  await prisma.route.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.warehouse.deleteMany({});

  console.log("🧹 Cleaned old entities for fresh South Indian data");

  // 3. Seed Warehouses (South Indian cities)
  const warehousesData = [
    {
      name: "Warehouse 1 — Hyderabad (Gachibowli)",
      address: "Financial District, Nanakramguda, Gachibowli, Hyderabad, Telangana 500032",
      latitude: 17.4401,
      longitude: 78.3489,
    },
    {
      name: "Warehouse 2 — Kakinada (Port Road)",
      address: "Commercial Port Road, Suryaraopeta, Kakinada, Andhra Pradesh 533001",
      latitude: 16.9891,
      longitude: 82.2475,
    },
    {
      name: "Warehouse 3 — Bengaluru (Whitefield)",
      address: "ITPL Main Road, EPIP Zone, Whitefield, Bengaluru, Karnataka 560066",
      latitude: 12.9698,
      longitude: 77.7499,
    },
    {
      name: "Warehouse 4 — Chennai (Guindy)",
      address: "Industrial Estate, Guindy, Chennai, Tamil Nadu 600032",
      latitude: 13.0067,
      longitude: 80.2026,
    },
    {
      name: "Warehouse 5 — Kochi (Kakkanad)",
      address: "Infopark Expressway, Kakkanad, Kochi, Kerala 682030",
      latitude: 10.0159,
      longitude: 76.3419,
    },
    {
      name: "Warehouse 6 — Vijayawada (Auto Nagar)",
      address: "100ft Road, Auto Nagar Industrial Area, Vijayawada, Andhra Pradesh 520007",
      latitude: 16.4971,
      longitude: 80.6811,
    },
    {
      name: "Warehouse 7 — Visakhapatnam (Gajuwaka)",
      address: "Steel Plant Road, Industrial Corridor, Gajuwaka, Visakhapatnam, Andhra Pradesh 530026",
      latitude: 17.6868,
      longitude: 83.2185,
    },
  ];

  const warehouses = [];
  for (const w of warehousesData) {
    const created = await prisma.warehouse.create({ data: w });
    warehouses.push(created);
  }
  console.log(`✅ Seeded ${warehouses.length} South Indian Warehouses`);

  // 4. Seed Vehicles
  const vehiclesData = [
    { plateNumber: "TS-09-EV-1024", type: VehicleType.VAN, capacityKg: 850, fuelType: FuelType.ELECTRIC },
    { plateNumber: "TS-07-HD-4412", type: VehicleType.TRUCK, capacityKg: 2400, fuelType: FuelType.DIESEL },
    { plateNumber: "AP-05-KK-8921", type: VehicleType.VAN, capacityKg: 950, fuelType: FuelType.CNG },
    { plateNumber: "KA-03-WF-3310", type: VehicleType.CAR, capacityKg: 400, fuelType: FuelType.PETROL },
    { plateNumber: "TN-09-CH-7788", type: VehicleType.VAN, capacityKg: 1100, fuelType: FuelType.DIESEL },
    { plateNumber: "KL-07-KC-5566", type: VehicleType.MOTORCYCLE, capacityKg: 120, fuelType: FuelType.ELECTRIC },
  ];

  const vehicles = [];
  for (const v of vehiclesData) {
    const created = await prisma.vehicle.create({ data: v });
    vehicles.push(created);
  }
  console.log(`✅ Seeded ${vehicles.length} Vehicles`);

  // 5. Seed Clear, Understandable South Indian Drivers
  const driversData = [
    {
      name: "Suresh Reddy",
      phone: "+91 98480 12345",
      licenseNumber: "TS-09-2018004123",
      vehicleId: vehicles[0].id,
    },
    {
      name: "Ramesh Varma",
      phone: "+91 94401 67890",
      licenseNumber: "AP-05-2019008741",
      vehicleId: vehicles[2].id,
    },
    {
      name: "Ananya Rao",
      phone: "+91 97000 54321",
      licenseNumber: "KA-03-2021003412",
      vehicleId: vehicles[3].id,
    },
    {
      name: "Karthik Kumar",
      phone: "+91 98840 98765",
      licenseNumber: "TN-09-2017006543",
      vehicleId: vehicles[4].id,
    },
    {
      name: "Sai Praneeth",
      phone: "+91 99890 23456",
      licenseNumber: "TS-07-2020009812",
      vehicleId: vehicles[1].id,
    },
    {
      name: "Venkatesh Naidu",
      phone: "+91 98660 76543",
      licenseNumber: "AP-16-2022001122",
      vehicleId: vehicles[5].id,
    },
  ];

  const drivers = [];
  for (const d of driversData) {
    const created = await prisma.driver.create({ data: d });
    drivers.push(created);
  }
  console.log(`✅ Seeded ${drivers.length} Drivers`);

  // 6. Seed Orders for Hyderabad (Gachibowli) and Kakinada (Port Road)
  const hydWarehouse = warehouses[0];
  const kkWarehouse = warehouses[1];

  const now = new Date();
  const plusHours = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);
  const minusHours = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

  const hydOrdersData = [
    {
      customerName: "Dr. Arvind Swamy (Apollo Clinic)",
      address: "Plot 42, Hitech City Main Rd, Madhapur, Hyderabad",
      latitude: 17.4504,
      longitude: 78.3808,
      priority: OrderPriority.HIGH,
      weightKg: 28.5,
      earliestDelivery: minusHours(1),
      latestDelivery: plusHours(2),
      status: OrderStatus.ASSIGNED,
      timeWindowStatus: TimeWindowStatus.AT_RISK,
      warehouseId: hydWarehouse.id,
    },
    {
      customerName: "Pooja Hegde (Tech Solutions)",
      address: "Tower 3, Cyber Gateway, HITEC City, Hyderabad",
      latitude: 17.4478,
      longitude: 78.3762,
      priority: OrderPriority.HIGH,
      weightKg: 15.0,
      earliestDelivery: minusHours(1),
      latestDelivery: plusHours(3),
      status: OrderStatus.ASSIGNED,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hydWarehouse.id,
    },
    {
      customerName: "Srikanth M. (Retail Hub)",
      address: "Shop 12, Forum Sujana Mall, Kukatpally, Hyderabad",
      latitude: 17.4842,
      longitude: 78.3888,
      priority: OrderPriority.MEDIUM,
      weightKg: 42.0,
      earliestDelivery: plusHours(1),
      latestDelivery: plusHours(5),
      status: OrderStatus.ASSIGNED,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hydWarehouse.id,
    },
    {
      customerName: "Venkata Raman (MedPlus Pharmacy)",
      address: "Road No 36, Jubilee Hills, Hyderabad",
      latitude: 17.4319,
      longitude: 78.4073,
      priority: OrderPriority.LOW,
      weightKg: 18.0,
      earliestDelivery: plusHours(2),
      latestDelivery: plusHours(6),
      status: OrderStatus.ASSIGNED,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hydWarehouse.id,
    },
    {
      customerName: "Murali Krishna (Fresh Mart)",
      address: "Near DLF Cybercity, Gachibowli, Hyderabad",
      latitude: 17.4452,
      longitude: 78.3582,
      priority: OrderPriority.HIGH,
      weightKg: 35.0,
      earliestDelivery: minusHours(2),
      latestDelivery: minusHours(0.5), // Past deadline -> Violated
      status: OrderStatus.PENDING,
      timeWindowStatus: TimeWindowStatus.VIOLATED,
      warehouseId: hydWarehouse.id,
    },
    {
      customerName: "Lakshmi Narayana (BioTech Labs)",
      address: "Genome Valley, Shamirpet, Hyderabad",
      latitude: 17.6184,
      longitude: 78.5833,
      priority: OrderPriority.MEDIUM,
      weightKg: 20.0,
      earliestDelivery: plusHours(2),
      latestDelivery: plusHours(8),
      status: OrderStatus.PENDING,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hydWarehouse.id,
    },
  ];

  const hydOrders = [];
  for (const o of hydOrdersData) {
    const created = await prisma.order.create({ data: o });
    hydOrders.push(created);
  }

  // Kakinada orders
  const kkOrdersData = [
    {
      customerName: "Subba Rao (Coromandel Agro)",
      address: "Beach Road, NFCL Township, Kakinada",
      latitude: 16.9950,
      longitude: 82.2560,
      priority: OrderPriority.HIGH,
      weightKg: 45.0,
      earliestDelivery: minusHours(1),
      latestDelivery: plusHours(2),
      status: OrderStatus.ASSIGNED,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kkWarehouse.id,
    },
    {
      customerName: "K. Satyanarayana (Port Logistics)",
      address: "Anchorage Road, Jagannaickpur, Kakinada",
      latitude: 16.9420,
      longitude: 82.2340,
      priority: OrderPriority.MEDIUM,
      weightKg: 80.0,
      earliestDelivery: plusHours(1),
      latestDelivery: plusHours(4),
      status: OrderStatus.ASSIGNED,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kkWarehouse.id,
    },
    {
      customerName: "Bhavani Silks & Textiles",
      address: "Main Road, Cinema Hall Area, Kakinada",
      latitude: 16.9604,
      longitude: 82.2382,
      priority: OrderPriority.LOW,
      weightKg: 22.0,
      earliestDelivery: plusHours(2),
      latestDelivery: plusHours(6),
      status: OrderStatus.PENDING,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kkWarehouse.id,
    },
  ];

  const kkOrders = [];
  for (const o of kkOrdersData) {
    const created = await prisma.order.create({ data: o });
    kkOrders.push(created);
  }

  // 6b. Fresh PENDING orders — simulate "just received from company" for dispatcher to optimize
  // These represent new delivery requests the company sent into the system today
  const freshIncomingOrders = [
    {
      customerName: "MedLife Pharmacy — Kondapur",
      address: "Plot 18, Kondapur Main Road, Near IKEA, Hyderabad",
      latitude: 17.4600,
      longitude: 78.3520,
      priority: OrderPriority.HIGH,
      weightKg: 12.5,
      earliestDelivery: plusHours(0),
      latestDelivery: plusHours(3),
      status: OrderStatus.PENDING,
      timeWindowStatus: TimeWindowStatus.AT_RISK,
      warehouseId: hydWarehouse.id,
    },
    {
      customerName: "Sai Electronics — Ameerpet",
      address: "6-3-349, Ameerpet Metro Station Road, Hyderabad",
      latitude: 17.4375,
      longitude: 78.4483,
      priority: OrderPriority.MEDIUM,
      weightKg: 32.0,
      earliestDelivery: plusHours(1),
      latestDelivery: plusHours(6),
      status: OrderStatus.PENDING,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hydWarehouse.id,
    },
    {
      customerName: "Krishna Sweets — Banjara Hills",
      address: "Road No 12, Banjara Hills, Hyderabad",
      latitude: 17.4239,
      longitude: 78.4388,
      priority: OrderPriority.LOW,
      weightKg: 18.0,
      earliestDelivery: plusHours(2),
      latestDelivery: plusHours(8),
      status: OrderStatus.PENDING,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: hydWarehouse.id,
    },
    {
      customerName: "Coastal Fish Traders — Kakinada Port",
      address: "Fish Auction Hall, Harbour Road, Kakinada",
      latitude: 16.9745,
      longitude: 82.2612,
      priority: OrderPriority.HIGH,
      weightKg: 75.0,
      earliestDelivery: plusHours(0),
      latestDelivery: plusHours(4),
      status: OrderStatus.PENDING,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kkWarehouse.id,
    },
    {
      customerName: "Rajiv Gandhi Medical College",
      address: "NH-16 Bypass Road, Undi, Near Kakinada",
      latitude: 16.9123,
      longitude: 82.2145,
      priority: OrderPriority.HIGH,
      weightKg: 9.5,
      earliestDelivery: plusHours(1),
      latestDelivery: plusHours(3),
      status: OrderStatus.PENDING,
      timeWindowStatus: TimeWindowStatus.NONE,
      warehouseId: kkWarehouse.id,
    },
  ];

  for (const o of freshIncomingOrders) {
    await prisma.order.create({ data: o });
  }

  console.log(`✅ Seeded ${hydOrders.length + kkOrders.length} historical + ${freshIncomingOrders.length} fresh PENDING orders (received from company, awaiting dispatcher optimization)`);

  // 7. Seed Active Route for Driver Suresh Reddy (Hyderabad)
  const sureshDriver = drivers[0];
  const sureshVehicle = vehicles[0];

  const activeRoute = await prisma.route.create({
    data: {
      driverId: sureshDriver.id,
      vehicleId: sureshVehicle.id,
      warehouseId: hydWarehouse.id,
      status: RouteStatus.IN_PROGRESS,
      totalDistanceKm: 26.4,
      estimatedDurationMin: 68,
      plannedDepartureAt: minusHours(1),
      actualDepartureAt: minusHours(0.75),
    },
  });

  // Create stops for Suresh's route
  const assignedHydOrders = hydOrders.slice(0, 4);
  const stopStatuses = [
    RouteStopStatus.COMPLETED,
    RouteStopStatus.PENDING,
    RouteStopStatus.PENDING,
    RouteStopStatus.PENDING,
  ];

  for (let i = 0; i < assignedHydOrders.length; i++) {
    const order = assignedHydOrders[i];
    const stopStatus = stopStatuses[i];
    await prisma.routeStop.create({
      data: {
        routeId: activeRoute.id,
        orderId: order.id,
        stopSequence: i + 1,
        status: stopStatus,
        projectedArrival: plusHours((i + 1) * 0.4),
        actualArrival: stopStatus === RouteStopStatus.COMPLETED ? minusHours(0.2) : null,
      },
    });

    if (stopStatus === RouteStopStatus.COMPLETED) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED },
      });
    }
  }

  // 8. Seed Planned Route for Driver Ramesh Varma (Kakinada)
  const rameshDriver = drivers[1];
  const rameshVehicle = vehicles[2];

  const plannedRoute = await prisma.route.create({
    data: {
      driverId: rameshDriver.id,
      vehicleId: rameshVehicle.id,
      warehouseId: kkWarehouse.id,
      status: RouteStatus.PLANNED,
      totalDistanceKm: 18.2,
      estimatedDurationMin: 45,
      plannedDepartureAt: plusHours(1),
    },
  });

  const assignedKkOrders = kkOrders.slice(0, 2);
  for (let i = 0; i < assignedKkOrders.length; i++) {
    const order = assignedKkOrders[i];
    await prisma.routeStop.create({
      data: {
        routeId: plannedRoute.id,
        orderId: order.id,
        stopSequence: i + 1,
        status: RouteStopStatus.PENDING,
        projectedArrival: plusHours(1 + (i + 1) * 0.35),
      },
    });
  }

  console.log("✅ Seeded Active and Planned Routes with sequential stops");
  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
