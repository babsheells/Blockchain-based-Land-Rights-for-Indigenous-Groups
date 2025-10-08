(define-constant contract-owner tx-sender)
(define-constant err-unauthorized (err u100))
(define-constant err-duplicate-parcel (err u101))
(define-constant err-not-found (err u102))
(define-constant err-invalid-hash (err u103))
(define-constant err-invalid-boundaries (err u104))
(define-constant err-invalid-community-id (err u105))
(define-constant err-invalid-description (err u106))
(define-constant err-invalid-timestamp (err u107))
(define-constant err-authority-not-verified (err u108))
(define-constant err-invalid-ownership-type (err u109))
(define-constant err-invalid-area (err u110))
(define-constant err-invalid-location (err u111))
(define-constant err-invalid-status (err u112))
(define-constant err-max-parcels-exceeded (err u113))
(define-constant err-invalid-update-param (err u114))
(define-constant err-update-not-allowed (err u115))
(define-constant err-invalid-verifier (err u116))
(define-constant err-invalid-docs-hash (err u117))
(define-constant err-invalid-coordinates (err u118))
(define-constant err-invalid-zone (err u119))
(define-constant err-invalid-access-level (err u120))

(define-data-var next-parcel-id uint u0)
(define-data-var max-parcels uint u5000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map land-parcels
  uint
  {
    geo-hash: (buff 32),
    boundaries: (string-utf8 500),
    community-id: uint,
    description: (string-utf8 1000),
    timestamp: uint,
    registrant: principal,
    ownership-type: (string-utf8 50),
    area: uint,
    location: (string-utf8 200),
    status: bool,
    docs-hash: (buff 32),
    coordinates: (string-utf8 500),
    zone: (string-utf8 100),
    access-level: uint
  }
)

(define-map parcels-by-hash
  (buff 32)
  uint)

(define-map parcel-updates
  uint
  {
    update-boundaries: (string-utf8 500),
    update-description: (string-utf8 1000),
    update-timestamp: uint,
    updater: principal,
    update-area: uint
  }
)

(define-read-only (get-parcel (id uint))
  (map-get? land-parcels id)
)

(define-read-only (get-parcel-updates (id uint))
  (map-get? parcel-updates id)
)

(define-read-only (is-parcel-registered (hash (buff 32)))
  (is-some (map-get? parcels-by-hash hash))
)

(define-private (validate-geo-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err err-invalid-hash))
)

(define-private (validate-boundaries (bounds (string-utf8 500)))
  (if (and (> (len bounds) u0) (<= (len bounds) u500))
      (ok true)
      (err err-invalid-boundaries))
)

(define-private (validate-community-id (cid uint))
  (if (> cid u0)
      (ok true)
      (err err-invalid-community-id))
)

(define-private (validate-description (desc (string-utf8 1000)))
  (if (<= (len desc) u1000)
      (ok true)
      (err err-invalid-description))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err err-invalid-timestamp))
)

(define-private (validate-ownership-type (otype (string-utf8 50)))
  (if (or (is-eq otype "communal") (is-eq otype "individual") (is-eq otype "tribal"))
      (ok true)
      (err err-invalid-ownership-type))
)

(define-private (validate-area (ar uint))
  (if (> ar u0)
      (ok true)
      (err err-invalid-area))
)

(define-private (validate-location (loc (string-utf8 200)))
  (if (and (> (len loc) u0) (<= (len loc) u200))
      (ok true)
      (err err-invalid-location))
)

(define-private (validate-docs-hash (dhash (buff 32)))
  (if (is-eq (len dhash) u32)
      (ok true)
      (err err-invalid-docs-hash))
)

(define-private (validate-coordinates (coords (string-utf8 500)))
  (if (and (> (len coords) u0) (<= (len coords) u500))
      (ok true)
      (err err-invalid-coordinates))
)

(define-private (validate-zone (zn (string-utf8 100)))
  (if (<= (len zn) u100)
      (ok true)
      (err err-invalid-zone))
)

(define-private (validate-access-level (level uint))
  (if (<= level u3)
      (ok true)
      (err err-invalid-access-level))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err err-unauthorized))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err err-authority-not-verified))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-parcels (new-max uint))
  (begin
    (asserts! (> new-max u0) (err err-invalid-update-param))
    (asserts! (is-some (var-get authority-contract)) (err err-authority-not-verified))
    (var-set max-parcels new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err err-invalid-update-param))
    (asserts! (is-some (var-get authority-contract)) (err err-authority-not-verified))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (register-parcel
  (geo-hash (buff 32))
  (boundaries (string-utf8 500))
  (community-id uint)
  (description (string-utf8 1000))
  (ownership-type (string-utf8 50))
  (area uint)
  (location (string-utf8 200))
  (docs-hash (buff 32))
  (coordinates (string-utf8 500))
  (zone (string-utf8 100))
  (access-level uint)
)
  (let (
        (next-id (var-get next-parcel-id))
        (current-max (var-get max-parcels))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err err-max-parcels-exceeded))
    (try! (validate-geo-hash geo-hash))
    (try! (validate-boundaries boundaries))
    (try! (validate-community-id community-id))
    (try! (validate-description description))
    (try! (validate-ownership-type ownership-type))
    (try! (validate-area area))
    (try! (validate-location location))
    (try! (validate-docs-hash docs-hash))
    (try! (validate-coordinates coordinates))
    (try! (validate-zone zone))
    (try! (validate-access-level access-level))
    (asserts! (is-none (map-get? parcels-by-hash geo-hash)) (err err-duplicate-parcel))
    (let ((authority-recipient (unwrap! authority (err err-authority-not-verified))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set land-parcels next-id
      {
        geo-hash: geo-hash,
        boundaries: boundaries,
        community-id: community-id,
        description: description,
        timestamp: block-height,
        registrant: tx-sender,
        ownership-type: ownership-type,
        area: area,
        location: location,
        status: true,
        docs-hash: docs-hash,
        coordinates: coordinates,
        zone: zone,
        access-level: access-level
      }
    )
    (map-set parcels-by-hash geo-hash next-id)
    (var-set next-parcel-id (+ next-id u1))
    (print { event: "parcel-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (update-parcel
  (parcel-id uint)
  (update-boundaries (string-utf8 500))
  (update-description (string-utf8 1000))
  (update-area uint)
)
  (let ((parcel (map-get? land-parcels parcel-id)))
    (match parcel
      p
        (begin
          (asserts! (is-eq (get registrant p) tx-sender) (err err-unauthorized))
          (try! (validate-boundaries update-boundaries))
          (try! (validate-description update-description))
          (try! (validate-area update-area))
          (map-set land-parcels parcel-id
            {
              geo-hash: (get geo-hash p),
              boundaries: update-boundaries,
              community-id: (get community-id p),
              description: update-description,
              timestamp: block-height,
              registrant: (get registrant p),
              ownership-type: (get ownership-type p),
              area: update-area,
              location: (get location p),
              status: (get status p),
              docs-hash: (get docs-hash p),
              coordinates: (get coordinates p),
              zone: (get zone p),
              access-level: (get access-level p)
            }
          )
          (map-set parcel-updates parcel-id
            {
              update-boundaries: update-boundaries,
              update-description: update-description,
              update-timestamp: block-height,
              updater: tx-sender,
              update-area: update-area
            }
          )
          (print { event: "parcel-updated", id: parcel-id })
          (ok true)
        )
      (err err-not-found)
    )
  )
)

(define-public (get-parcel-count)
  (ok (var-get next-parcel-id))
)

(define-public (check-parcel-existence (hash (buff 32)))
  (ok (is-parcel-registered hash))
)