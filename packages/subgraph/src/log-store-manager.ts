import {
	AdminChanged as AdminChangedEvent,
	BeaconUpgraded as BeaconUpgradedEvent,
	CaptureOverflow as CaptureOverflowEvent,
	DataStored as DataStoredEvent,
	Initialized as InitializedEvent,
	OwnershipTransferred as OwnershipTransferredEvent,
	StoreUpdated as StoreUpdatedEvent,
	SupplyOverflow as SupplyOverflowEvent,
	Upgraded as UpgradedEvent,
} from '../generated/LogStoreManager/LogStoreManager';
import {
	AdminChanged,
	BeaconUpgraded,
	CaptureOverflow,
	DataStored,
	Initialized,
	OwnershipTransferred,
	StoreUpdated,
	SupplyOverflow,
	Upgraded,
} from '../generated/schema';

export function handleAdminChanged(event: AdminChangedEvent): void {
	let entity = new AdminChanged(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.previousAdmin = event.params.previousAdmin;
	entity.newAdmin = event.params.newAdmin;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleBeaconUpgraded(event: BeaconUpgradedEvent): void {
	let entity = new BeaconUpgraded(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.beacon = event.params.beacon;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleCaptureOverflow(event: CaptureOverflowEvent): void {
	let entity = new CaptureOverflow(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.store = event.params.store;
	entity.stake = event.params.stake;
	entity.capture = event.params.capture;
	entity.overflow = event.params.overflow;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleDataStored(event: DataStoredEvent): void {
	let entity = new DataStored(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.store = event.params.store;
	entity.fees = event.params.fees;
	entity.bytesStored = event.params.bytesStored;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleInitialized(event: InitializedEvent): void {
	let entity = new Initialized(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.version = event.params.version;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleOwnershipTransferred(
	event: OwnershipTransferredEvent
): void {
	let entity = new OwnershipTransferred(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.previousOwner = event.params.previousOwner;
	entity.newOwner = event.params.newOwner;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleStoreUpdated(event: StoreUpdatedEvent): void {
	let entity = new StoreUpdated(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.store = event.params.store;
	entity.isNew = event.params.isNew;
	entity.amount = event.params.amount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleSupplyOverflow(event: SupplyOverflowEvent): void {
	let entity = new SupplyOverflow(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.supply = event.params.supply;
	entity.capture = event.params.capture;
	entity.overflow = event.params.overflow;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleUpgraded(event: UpgradedEvent): void {
	let entity = new Upgraded(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	);
	entity.implementation = event.params.implementation;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}
