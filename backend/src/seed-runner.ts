/**
 * Demo data for the college presentation.
 * One warehouse, a few Hyderabad stops, and one trip already assigned to the driver login.
 */
import {
  PrismaClient,
  VehicleType,
  FuelType,
  OrderPriority,
  OrderStatus,
  TimeWindowStatus,
  RouteStatus,
  RouteStopStatus,
  UserRole,
} from "@prisma/client";
import bcrypt from "./utils/password";

export async function ensureDemoUsers(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash("Password@123", 10);
  const demoUsers = [
    { email: "admin@smartroute.io", role: UserRole.ADMIN },
    { email: "dispatcher@smartroute.io", role: UserRole.DISPATCHER },
    { email: "driver@smartroute.io", role: UserRole.DRIVER },
  ];

  const users = await Promise.all(
    demoUsers.map(({ email, role }) =>
      prisma.user.upsert({
        where: { email },
        update: { passwordHash, role },
        create: { email, passwordHash, role },
      })
    )
  );

  return users[2];
}

export async function runSeed(prisma: PrismaClient): Promise<string[]> {
  const log: string[] = [];
  const L = (msg: string) => {
    log.push(msg);
    console.log(msg);
  };

  const driverUser = await ensureDemoUsers(prisma);
  L("Users ready");

  await prisma.timeWindowViolation.deleteMany({});
  await prisma.eTAPrediction.deleteMany({});
  await prisma.routeStop.deleteMany({});
  await prisma.route.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.warehouse.deleteMany({});

  const warehouse = await prisma.warehouse.create({
    data: {
      name: "Hyderabad Depot",
      address: "Gachibowli, Hyderabad",
      latitude: 17.4401,
      longitude: 78.3489,
    },
  });

  const van = await prisma.vehicle.create({
    data: { plateNumber: "TS-09-1024", type: VehicleType.VAN, capacityKg: 800, fuelType: FuelType.DIESEL },
  });
  const truck = await prisma.vehicle.create({
    data: { plateNumber: "TS-07-4412", type: VehicleType.TRUCK, capacityKg: 2000, fuelType: FuelType.DIESEL },
  });

  const suresh = await prisma.driver.create({
    data: {
      name: "Suresh Reddy",
      phone: "9848012345",
      licenseNumber: "TS-09-2018",
      vehicleId: van.id,
      userId: driverUser.id,
    },
  });
  await prisma.driver.create({
    data: {
      name: "Ramesh Varma",
      phone: "9440167890",
      licenseNumber: "TS-07-2019",
      vehicleId: truck.id,
    },
  });
  await prisma.driver.create({
    data: {
      name: "Ananya Rao",
      phone: "9700054321",
      licenseNumber: "TS-09-2021",
    },
  });

  const now = new Date();
  const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);

  const pending = [
    { customerName: "MedLife Pharmacy", address: "Kondapur, Hyderabad", latitude: 17.46, longitude: 78.352, priority: OrderPriority.HIGH, weightKg: 12 },
    { customerName: "Sai Electronics", address: "Ameerpet, Hyderabad", latitude: 17.4375, longitude: 78.4483, priority: OrderPriority.MEDIUM, weightKg: 30 },
    { customerName: "Krishna Sweets", address: "Banjara Hills, Hyderabad", latitude: 17.4239, longitude: 78.4388, priority: OrderPriority.LOW, weightKg: 18 },
    { customerName: "Apollo Clinic", address: "Madhapur, Hyderabad", latitude: 17.4504, longitude: 78.3808, priority: OrderPriority.HIGH, weightKg: 25 },
    { customerName: "Forum Mall", address: "Kukatpally, Hyderabad", latitude: 17.4842, longitude: 78.3888, priority: OrderPriority.MEDIUM, weightKg: 40 },
  ];

  await Promise.all(
    pending.map((order) =>
      prisma.order.create({
        data: {
          ...order,
          status: OrderStatus.PENDING,
          timeWindowStatus: TimeWindowStatus.NONE,
          warehouseId: warehouse.id,
          earliestDelivery: inHours(1),
          latestDelivery: inHours(6),
        },
      })
    )
  );

  const assigned = await Promise.all(
    [
      { customerName: "Fresh Mart", address: "Gachibowli, Hyderabad", latitude: 17.4452, longitude: 78.3582, priority: OrderPriority.HIGH, weightKg: 20, status: OrderStatus.DELIVERED },
      { customerName: "Cyber Gateway", address: "HITEC City, Hyderabad", latitude: 17.4478, longitude: 78.3762, priority: OrderPriority.HIGH, weightKg: 15, status: OrderStatus.ASSIGNED },
      { customerName: "MedPlus", address: "Jubilee Hills, Hyderabad", latitude: 17.4319, longitude: 78.4073, priority: OrderPriority.MEDIUM, weightKg: 10, status: OrderStatus.ASSIGNED },
    ].map((order) =>
      prisma.order.create({
        data: {
          ...order,
          timeWindowStatus: TimeWindowStatus.NONE,
          warehouseId: warehouse.id,
          earliestDelivery: ago(1),
          latestDelivery: inHours(3),
        },
      })
    )
  );

  const route = await prisma.route.create({
    data: {
      driverId: suresh.id,
      vehicleId: van.id,
      warehouseId: warehouse.id,
      status: RouteStatus.IN_PROGRESS,
      totalDistanceKm: 18.4,
      estimatedDurationMin: 45,
      plannedDepartureAt: ago(1),
      actualDepartureAt: ago(0.8),
    },
  });

  const stops = [
    { orderId: assigned[0].id, seq: 1, status: RouteStopStatus.COMPLETED, arrival: ago(0.4) },
    { orderId: assigned[1].id, seq: 2, status: RouteStopStatus.PENDING, arrival: inHours(0.4) },
    { orderId: assigned[2].id, seq: 3, status: RouteStopStatus.PENDING, arrival: inHours(0.8) },
  ];
  for (const stop of stops) {
    await prisma.routeStop.create({
      data: {
        routeId: route.id,
        orderId: stop.orderId,
        stopSequence: stop.seq,
        status: stop.status,
        projectedArrival: stop.arrival,
        actualArrival: stop.status === RouteStopStatus.COMPLETED ? ago(0.3) : null,
      },
    });
  }

  L("Demo data loaded: Hyderabad depot, 5 pending orders, 1 active trip");
  return log;
}
