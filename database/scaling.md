# 데이터베이스 스케일링: 수직 스케일링(Vertical Scaling)과 수평 스케일링(Horizontal Scaling)

## 차이점

**수직 스케일링(Vertical Scaling / Scale-Up)**은 기존의 단일 서버의 하드웨어 성능을 높이는 방법입니다. 예를 들어, 더 빠른 CPU, 더 많은 RAM, 또는 더 큰 디스크 공간을 추가하는 방식으로 시스템 성능을 향상시킬 수 있습니다. 데이터베이스는 동일한 인스턴스에서 운영되며, 시스템 자체는 변경되지 않으므로 애플리케이션 코드는 수정할 필요가 없습니다.

**수평 스케일링(Horizontal Scaling / Scale-Out)**은 여러 서버를 추가하여 데이터베이스의 부하를 분산하는 방법입니다. 여러 개의 데이터베이스 인스턴스를 추가하여 데이터와 트래픽을 분산시킵니다. 일반적으로 로드 밸런서를 사용해 요청을 여러 서버로 분산 처리하며, 각 서버는 동일한 데이터베이스를 호스팅하거나 데이터의 일부만 저장할 수도 있습니다.

## 장단점

### 수직 스케일링

**장점:**

- **단순성:** 애플리케이션 아키텍처를 변경할 필요 없이, 하드웨어 성능 향상만으로 성능을 개선할 수 있습니다.
- **관리 용이성:** 단일 서버에서 운영되므로 관리와 모니터링이 단순합니다.

**단점:**

- **확장 한계:** 하드웨어 업그레이드에는 물리적인 한계가 있으며, 성능을 무한정으로 향상시킬 수 없습니다.
- **단일 장애 지점(Single Point of Failure):** 단일 서버에 모든 데이터와 트래픽이 집중되기 때문에, 서버 장애 시 전체 서비스에 영향이 미칩니다.

### 수평 스케일링

**장점:**

- **높은 확장성:** 서버를 추가하는 방식으로 쉽게 확장할 수 있으며, 이론적으로는 무한히 확장이 가능합니다.
- **장애 격리:** 여러 서버에 부하가 분산되므로, 하나의 서버가 장애를 겪어도 전체 시스템에는 큰 영향을 주지 않습니다.

**단점:**

- **복잡성 증가:** 데이터 동기화, 분산 트랜잭션 관리 등 추가적인 복잡성이 발생합니다.
- **관리 부담:** 여러 서버를 관리하고 모니터링해야 하므로 관리가 어려워질 수 있습니다.

# 데이터베이스 샤딩(Sharding)

## 설명

**샤딩(Sharding)**은 대규모 데이터를 여러 개의 분리된 데이터베이스 인스턴스에 나누어 저장하는 기술입니다. 각 데이터베이스 인스턴스를 **샤드(Shard)**라고 하며, 데이터는 특정 기준에 따라 각 샤드에 분배됩니다. 예를 들어, 사용자 ID에 따라 데이터를 여러 샤드에 분배할 수 있습니다.

## 샤딩을 사용해야 하는 상황

샤딩이 필요한 상황은 주로 데이터의 양이 매우 크거나, 트래픽이 특정 데이터베이스 인스턴스에 집중되어 성능 저하가 발생할 때입니다. 특히 수평 스케일링이 필요하지만, 단순히 서버를 추가하는 것만으로는 해결되지 않는 경우에 샤딩을 고려합니다.

## 장단점

**장점:**

- **성능 향상:** 데이터베이스 인스턴스당 처리해야 하는 데이터 양이 줄어들어 성능이 향상됩니다.
- **확장성:** 각 샤드는 독립적으로 확장할 수 있으므로, 데이터 양이 증가해도 새로운 샤드를 추가하여 처리할 수 있습니다.
- **장애 격리:** 하나의 샤드가 장애를 겪더라도 다른 샤드에는 영향을 미치지 않아 전체 시스템의 안정성이 높아집니다.

**단점:**

- **복잡한 쿼리:** 샤드에 분배된 데이터를 조합해서 처리해야 하는 복잡한 쿼리를 실행하기 어려울 수 있습니다.
- **데이터 분포 불균형:** 샤딩 전략에 따라 특정 샤드에 데이터가 집중될 수 있으며, 이로 인해 특정 샤드에 성능 병목이 발생할 수 있습니다.
- **운영 복잡성:** 샤드가 늘어날수록 관리, 모니터링, 백업 등이 복잡해지며, 운영 비용이 증가할 수 있습니다.

## 샤딩 전략

샤딩 전략을 선택할 때 고려해야 할 요소로는 데이터 액세스 패턴, 데이터 일관성 요구사항, 확장성 필요성, 애플리케이션의 쿼리 복잡성 등이 있습니다. 주요 샤딩 전략으로는 다음이 있습니다:

- **범위 기반 샤딩(Range-based Sharding)**: 샤딩 키의 값에 따라 특정 범위의 데이터를 각 샤드에 할당하는 방법입니다. 예를 들어, 사용자 ID가 11000인 데이터는 샤드 A에, 10012000인 데이터는 샤드 B에 할당하는 방식입니다. 이 방식은 구현이 간단하지만, 특정 범위에 데이터가 집중될 경우 불균형 문제가 발생할 수 있습니다.

- **해시 기반 샤딩(Hash-based Sharding)**: 샤딩 키에 해시 함수를 적용하여 해시 값에 따라 데이터를 샤드에 분배하는 방법입니다. 해시 기반 샤딩은 데이터가 균등하게 분포되도록 도와주지만, 해시 충돌이나 샤드 추가 시 재분배 문제를 고려해야 합니다.

- **지리적 샤딩(Geographic Sharding)**: 데이터의 지리적 위치에 따라 샤드를 나누는 방법입니다. 예를 들어, 아시아 지역 사용자 데이터를 아시아 데이터 센터에, 북미 지역 사용자 데이터를 북미 데이터 센터에 저장하는 방식입니다. 이 방식은 지리적으로 분산된 사용자에게 낮은 지연 시간을 제공할 수 있습니다.

# 읽기 성능 향상을 위한 읽기 복제본(Read Replica) 설정

## 설명

**읽기 복제본(Read Replica)**은 주 데이터베이스의 읽기 작업 부하를 분산하기 위해 사용하는 복제본입니다. 주 데이터베이스에 쓰기 작업이 발생하면, 그 데이터가 읽기 복제본으로 복제되어 읽기 전용으로 사용됩니다. 일반적으로 주 데이터베이스의 성능을 보존하면서도 읽기 요청을 처리하기 위한 용도로 사용됩니다.

## 장단점

**장점:**

- **읽기 성능 향상:** 읽기 요청을 여러 읽기 복제본에 분산시켜 처리할 수 있어, 주 데이터베이스의 부하를 줄이고 성능을 향상시킬 수 있습니다.
- **확장성:** 읽기 복제본을 추가하는 방식으로 쉽게 읽기 성능을 확장할 수 있습니다. 필요에 따라 읽기 복제본의 개수를 늘려 트래픽 증가에 대응할 수 있습니다.
- **재해 복구(Disaster Recovery):** 읽기 복제본을 사용해 데이터베이스 장애 시 빠르게 읽기 작업을 복구할 수 있습니다.

**단점:**

- **복제 지연(Lag):** 주 데이터베이스에서 읽기 복제본으로 데이터가 복제되는 과정에서 약간의 지연이 발생할 수 있습니다. 실시간 데이터 일관성이 중요한 애플리케이션에는 문제가 될 수 있습니다.
- **쓰기 작업의 부하 증가:** 주 데이터베이스에서 발생한 모든 쓰기 작업이 읽기 복제본으로 복제되어야 하므로, 복제 과정에서 쓰기 작업의 부하가 증가할 수 있습니다.
- **운영 복잡성:** 읽기 복제본의 운영, 모니터링, 장애 처리 등을 관리해야 하므로, 시스템 관리가 복잡해질 수 있습니다.