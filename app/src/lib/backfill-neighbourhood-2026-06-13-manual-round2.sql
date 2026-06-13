-- ============================================================================
-- HalalNomad — manual neighbourhood tagging round 2 (2026-06-13)  [100% set]
-- ============================================================================
-- Tags every place the 2026-06-14 auto-backfill left NULL, by id. After COMMIT,
-- Tokyo and Singapore are both 100% neighbourhood-tagged.
--   * Tokyo: 6 (4 ward-kanji recoveries + 2 Kichijoji = Musashino city, added
--     as a non-ward neighbourhood per Sani 2026-06-13).
--   * Singapore: 124, incl. 16 NEW neighbourhoods (14 + Newton + Siglap).
-- Same safety pattern: BEGIN ... ROLLBACK -> review grid -> COMMIT.
-- Every UPDATE guarded `neighbourhood IS NULL`.
-- ============================================================================

BEGIN;

-- Tokyo (6) ----------------------------------------------------------------
UPDATE places AS p SET neighbourhood = v.nb
FROM (VALUES
  ('4c48ea58-6dfc-43c1-b3d4-7466402b871c'::uuid, 'Bunkyo'),
  ('8f9e1546-e723-4155-974f-d8f85c187e5b'::uuid, 'Toshima'),
  ('774f1025-4edc-45f0-ae5e-a5f2ff4cb964'::uuid, 'Chiyoda'),
  ('6dde38d7-1a96-4f1d-b215-1699417b12a7'::uuid, 'Toshima'),
  ('39d5e15e-1e21-4fc9-a2bc-ba531f91d35f'::uuid, 'Kichijoji'),
  ('9434eab4-3250-4cc3-ad62-5eb8d7c3d1fd'::uuid, 'Kichijoji')
) AS v(id, nb)
WHERE p.id = v.id AND p.neighbourhood IS NULL;

-- Singapore (124) ----------------------------------------------------------
UPDATE places AS p SET neighbourhood = v.nb
FROM (VALUES
  ('361d8a5d-3772-4448-ba98-ae921e164266'::uuid, 'Clementi'),
  ('c4d3ef48-ea00-42af-ab0b-857b117be1ca'::uuid, 'Tanjong Pagar'),
  ('c62fd2d6-857b-4904-afbb-ab992580e358'::uuid, 'Clementi'),
  ('f9f8f25a-465b-4062-b270-c769fa919a2e'::uuid, 'Tanjong Pagar'),
  ('fa34c661-4767-4aea-ae14-519f5e14cfe7'::uuid, 'Raffles Place'), -- NEW
  ('c880b6db-31d8-4c9e-8588-4fbd351fd047'::uuid, 'Jalan Besar'), -- NEW
  ('98bd094d-9c70-4e9d-9e9f-5e7208cf3582'::uuid, 'River Valley'), -- NEW
  ('91e3923b-53c0-41a5-9b61-62d4801608a4'::uuid, 'Geylang'), -- NEW
  ('af416423-30ca-4889-9ccd-adb916505d52'::uuid, 'Bukit Batok'), -- NEW
  ('ab294228-3bc9-425c-bfff-bb39951c332c'::uuid, 'Raffles Place'), -- NEW
  ('404cd18a-3c72-44c7-a61c-a036e5826c25'::uuid, 'Geylang'), -- NEW
  ('bfbfd3c6-73e8-4178-8602-63d4b00b740d'::uuid, 'Marina Bay'),
  ('5311ff62-632e-47ce-8c6a-f46d1bf2f9a3'::uuid, 'Geylang'), -- NEW
  ('56a8f5f5-9008-4f95-9838-f2a25cb68401'::uuid, 'Raffles Place'), -- NEW
  ('cd02334a-2aed-440f-84cf-9850b3719302'::uuid, 'Kallang'), -- NEW
  ('425fa92f-d718-4f22-835e-8ad8fcf24073'::uuid, 'Marina Bay'),
  ('03ffa3d2-0cf3-42aa-8bfa-05b7b4b77d68'::uuid, 'Raffles Place'), -- NEW
  ('42e21438-53c0-4114-8461-b4c08c3bed3b'::uuid, 'Orchard'),
  ('7a7d590e-a4f3-42a5-bfee-87e0838040c3'::uuid, 'Tanjong Pagar'),
  ('f326d632-2beb-42b5-8816-060d0f594a6a'::uuid, 'Marina Bay'),
  ('9410a4d4-1882-4849-ac7f-9fc0ab3b30c2'::uuid, 'Marina Bay'),
  ('91681385-57b4-4d26-ba77-589b78198196'::uuid, 'Orchard'),
  ('f05e5e5a-b0ed-4ce7-9489-6b4d9af515e3'::uuid, 'Orchard'),
  ('4797b646-9d03-4b22-8de4-8fa838bd62a7'::uuid, 'Geylang Serai'),
  ('1866b0c9-b0df-4bd3-b9b0-ddb429d773d2'::uuid, 'MacPherson'), -- NEW
  ('5ed2bfa4-9fcd-4b14-b44f-d58804f6339d'::uuid, 'Little India'),
  ('9c6be326-08cf-4b49-9bb9-1b050686649c'::uuid, 'Geylang Serai'),
  ('c10fc65a-b7c0-4462-aa7d-14abdaccc411'::uuid, 'Geylang'), -- NEW
  ('2ec93875-e3f1-4092-987c-da84b377625d'::uuid, 'Tanjong Pagar'),
  ('63bc9a5c-7cff-4acb-9c1d-9c916f8e4f94'::uuid, 'Paya Lebar'), -- NEW
  ('5ef7657b-f2d7-4f15-a8b6-642449b45add'::uuid, 'Paya Lebar'), -- NEW
  ('69bc8a0c-60ab-4c20-965f-b5d044998c66'::uuid, 'Paya Lebar'), -- NEW
  ('df2a219d-dc5e-41d4-a8a4-0e1678a7af9f'::uuid, 'Geylang Serai'),
  ('f0c4313c-c969-45a0-abed-68d917782608'::uuid, 'Paya Lebar'), -- NEW
  ('4076806f-5027-42eb-bbaf-365bf0eb2042'::uuid, 'Paya Lebar'), -- NEW
  ('32196987-ff74-4ba3-b83d-9aa03b552057'::uuid, 'Geylang'), -- NEW
  ('567a3511-cfc4-4846-b25e-8695646e5870'::uuid, 'Raffles Place'), -- NEW
  ('6f300ec2-1e22-42b9-aa3b-a1507df35be4'::uuid, 'Geylang'), -- NEW
  ('d9c743b3-74db-48be-83df-7afce782b491'::uuid, 'Paya Lebar'), -- NEW
  ('5fb6e987-fb0b-4742-9ed1-949355267817'::uuid, 'Geylang Serai'),
  ('a37b84f2-06a5-48b8-a454-cf6336e05bc8'::uuid, 'Marine Parade'), -- NEW
  ('06ede71a-9a78-4023-a022-ccdb3fb4eec1'::uuid, 'MacPherson'), -- NEW
  ('4afefec0-75b6-4e5a-874d-4bc172eaa311'::uuid, 'Paya Lebar'), -- NEW
  ('e4f0a3eb-cb23-40c0-8445-899dd4668a8d'::uuid, 'Chinatown'),
  ('2243ef16-cbfc-49a2-8f2c-2b3924ff766f'::uuid, 'Raffles Place'), -- NEW
  ('70f4f623-cb5d-4c58-9222-7d78db36bb76'::uuid, 'Tanjong Pagar'),
  ('4bac8bb7-60aa-4bd7-9efb-18134a31f966'::uuid, 'Marina Bay'),
  ('612ba3df-d7cf-4f73-92e4-d2d2dcd8f796'::uuid, 'Raffles Place'), -- NEW
  ('10b58476-991b-418b-b8a9-d00c8e31ec94'::uuid, 'MacPherson'), -- NEW
  ('1df620b2-465b-4b93-b54f-9f723260e0eb'::uuid, 'Geylang Serai'),
  ('99c7868c-1a32-4238-891d-00fe980b8346'::uuid, 'Paya Lebar'), -- NEW
  ('2c667f7a-c0bb-406c-97b4-e787709f5100'::uuid, 'HarbourFront'), -- NEW
  ('1c97e64c-2279-4546-89af-ba3bc66f6d03'::uuid, 'Orchard'),
  ('4052fb10-b7c0-4d3e-adcd-9b8bf41bbcf4'::uuid, 'Orchard'),
  ('be1f6f56-2f72-4981-a028-ac65c21b2d5e'::uuid, 'Orchard'),
  ('1bd1e9e6-5738-4ca9-9ff3-40e2c6ad6790'::uuid, 'Orchard'),
  ('3434a98f-d5ed-4827-b681-8c280a67ead3'::uuid, 'Tampines'),
  ('7a4f8891-218f-4fe8-90e5-96f4e1d55619'::uuid, 'Bukit Batok'), -- NEW
  ('a3c5872b-8280-45df-ac30-c1ce764942a8'::uuid, 'Bukit Batok'), -- NEW
  ('fd15bd5b-01fa-439e-b4b7-269a1dd7396d'::uuid, 'Tampines'),
  ('9a6d0298-ceb5-43ef-8586-2070a05f9fdc'::uuid, 'Clementi'),
  ('80bdd06a-c638-46ef-8afe-ae9e35ea1bb4'::uuid, 'Jurong West'), -- NEW
  ('17e15f8b-5c2e-48f4-a125-3068c58fc864'::uuid, 'Clementi'),
  ('501af152-8bca-4e78-8076-bcbd3bbeb82a'::uuid, 'Bukit Batok'), -- NEW
  ('148027a3-a083-45ac-b398-2c8e54eb0a54'::uuid, 'Bukit Batok'), -- NEW
  ('e9dc12c5-4e47-4f49-9016-c9b989857d9e'::uuid, 'Bukit Batok'), -- NEW
  ('84e525eb-a7f0-4adb-810f-b7946ffa6bd0'::uuid, 'Jurong East'),
  ('d7ab9338-a531-459b-ba58-0a8ab6e29b4e'::uuid, 'Jurong East'),
  ('57976bcd-062b-426e-8c6f-20563609ba1a'::uuid, 'Bukit Batok'), -- NEW
  ('ebf095be-80f6-453b-994f-957d5ddd4b58'::uuid, 'Jurong East'),
  ('d542c73b-a0ac-4f44-8f4e-ddf384c0537e'::uuid, 'Bukit Batok'), -- NEW
  ('1e284199-ee45-4b4e-ad40-ab7bded31768'::uuid, 'Bukit Batok'), -- NEW
  ('91d3af6e-79a1-4142-9fa1-8371fe5e404c'::uuid, 'Jurong West'), -- NEW
  ('01877409-1e99-40f8-923c-828f88a46578'::uuid, 'Bukit Batok'), -- NEW
  ('d9981b71-5854-4cb4-a01b-ac59b8efbbe1'::uuid, 'Marina Bay'),
  ('d4e0267d-af97-4de6-b661-ffb5a9aad834'::uuid, 'Jurong West'), -- NEW
  ('5855a916-43cd-4e12-bc6f-68ea9f621ddd'::uuid, 'Geylang'), -- NEW
  ('83650e20-1cc8-4a8e-a102-c7d2dc74fb70'::uuid, 'Marine Parade'), -- NEW
  ('44b5f45a-4df2-4c7b-b990-09203fde51b6'::uuid, 'Clementi'),
  ('d2200633-7648-4f30-a202-2c05a48a652e'::uuid, 'Raffles Place'), -- NEW
  ('7e91cbb3-8a87-4632-8fff-329a0ed63328'::uuid, 'Geylang'), -- NEW
  ('27bfbcb4-bed1-47cf-9e7a-a62c285cedbb'::uuid, 'Chinatown'),
  ('0f4c6985-0416-4acd-bde9-231f40a19a5d'::uuid, 'Raffles Place'), -- NEW
  ('1a0fc62f-ff39-4512-9913-bc1cf0434407'::uuid, 'Bras Basah'), -- NEW
  ('d3252752-9866-4e57-8c04-2ef1003c97c0'::uuid, 'Tanjong Pagar'),
  ('94381ee1-55be-4672-975c-5291cfb90940'::uuid, 'Orchard'),
  ('21966e10-de14-4d26-8ac4-56c58000cdbe'::uuid, 'Kallang'), -- NEW
  ('6a6743cd-578e-43e3-88bc-726d8e3c8623'::uuid, 'Tanjong Pagar'),
  ('28ef47ce-5f31-499f-8330-674969130f57'::uuid, 'Tiong Bahru'),
  ('bed3912a-86e4-4b04-863e-f13347854039'::uuid, 'Tanjong Pagar'),
  ('1bfd9787-849a-4af2-ad13-639dea534fcd'::uuid, 'River Valley'), -- NEW
  ('25cdd538-b22d-43fa-9839-a4f1ceefc22a'::uuid, 'Paya Lebar'), -- NEW
  ('8b1a022a-4b45-44ce-8d31-fdf7d0ac3961'::uuid, 'MacPherson'), -- NEW
  ('ea8db6f2-2959-404b-b331-a12e0ded975a'::uuid, 'Paya Lebar'), -- NEW
  ('8dc59b83-997c-4793-9880-1bd12486142f'::uuid, 'Geylang Serai'),
  ('12197eb5-a87f-4dac-8dc2-b88b4c4ed79e'::uuid, 'Paya Lebar'), -- NEW
  ('bdf372b1-a866-460d-a129-c9f73b615982'::uuid, 'MacPherson'), -- NEW
  ('d3a2b4b9-50b1-4d60-9f1d-ea357117e617'::uuid, 'Tanjong Pagar'),
  ('e3701f88-11e8-4369-9023-4f6d87c81197'::uuid, 'Tiong Bahru'),
  ('a12d4eb7-7229-4bd8-a002-61ee495785b8'::uuid, 'Marina Bay'),
  ('69e6ab54-0bea-431f-8c5a-cfb21a9fbdc7'::uuid, 'Raffles Place'), -- NEW
  ('56ecb873-877e-4cbf-94f7-b8379b6d04a1'::uuid, 'Orchard'),
  ('9070e0da-6b55-4167-8a67-77e7b66ac67d'::uuid, 'Raffles Place'), -- NEW
  ('04242424-2de0-4b17-b2fd-9f95062e681a'::uuid, 'Orchard'),
  ('84776548-1d05-4e85-84ed-ee6a319f5c01'::uuid, 'Bukit Merah'), -- NEW
  ('113ddbaf-c9fe-4d4a-b58c-bbcd422b2460'::uuid, 'Chinatown'),
  ('aedf3f97-c5da-45de-85fb-c071e7e5a241'::uuid, 'Tampines'),
  ('75618df8-28c8-4766-bb9f-451aee66a64b'::uuid, 'Changi'),
  ('5507cb3d-ae2e-44b5-9ace-b8901f5fae84'::uuid, 'Changi'),
  ('e80d5ae7-f064-4a03-930c-98bd95e4779c'::uuid, 'Chinatown'),
  ('cbcc2145-4ae7-42ea-b4ea-98a99d5770d5'::uuid, 'Bukit Batok'), -- NEW
  ('6a1f3564-f7bb-49dd-a519-d855212fafee'::uuid, 'Taman Jurong'), -- NEW
  ('e838bfb2-6938-48a0-9a41-e0e3529df45b'::uuid, 'Taman Jurong'), -- NEW
  ('f8f386cc-8cbf-4e9a-a424-c279ecaf0aac'::uuid, 'Jurong East'),
  ('2b2fe92e-7822-42b3-8e05-a616a6c0fffe'::uuid, 'Bukit Batok'), -- NEW
  ('4bfc7838-ad53-43a6-9ed1-eb7846c091fc'::uuid, 'Bukit Batok'), -- NEW
  ('29745c49-8ef6-4605-82d5-6b99d9580b76'::uuid, 'Taman Jurong'), -- NEW
  ('26b84357-b262-4f04-906d-c376a6619ead'::uuid, 'Bukit Batok'), -- NEW
  ('72967843-a858-46d7-8f21-28e04b34a8dc'::uuid, 'Marine Parade'), -- NEW
  ('9dc988e7-9f6b-408d-9644-96158df04a69'::uuid, 'Marine Parade'), -- NEW
  ('70db078f-5bf4-4ae3-b4ff-c9c16c4f401b'::uuid, 'Paya Lebar'), -- NEW
  ('b60327c9-de08-489e-8ef5-560db623be96'::uuid, 'Paya Lebar'), -- NEW
  ('8f549090-a277-4673-8326-0d2f3ff302c9'::uuid, 'Newton'), -- NEW
  ('b4b91216-07d9-4226-922c-4aa2df6550cd'::uuid, 'Siglap') -- NEW
) AS v(id, nb)
WHERE p.id = v.id AND p.neighbourhood IS NULL;

-- POST-FLIGHT — coverage + distribution (single grid)
SELECT section, city, label, count FROM (
  SELECT 1 ord,'COVERAGE' section, city, 'tagged' label,
         COUNT(*) FILTER (WHERE neighbourhood IS NOT NULL) count
    FROM places WHERE city IN ('Tokyo','Singapore') GROUP BY city
  UNION ALL SELECT 1,'COVERAGE',city,'still_null',
         COUNT(*) FILTER (WHERE neighbourhood IS NULL)
    FROM places WHERE city IN ('Tokyo','Singapore') GROUP BY city
  UNION ALL SELECT 2,'DISTRIBUTION',city,neighbourhood,COUNT(*)
    FROM places WHERE city IN ('Tokyo','Singapore') AND neighbourhood IS NOT NULL
    GROUP BY city,neighbourhood
) t ORDER BY ord, city, count DESC, label;

-- Expected: Tokyo tagged 181 / null 0 ; Singapore tagged 265 / null 0.
ROLLBACK;
