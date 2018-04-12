"use strict";
"use mocha";

require("c9/inline-mocha")(module);
var assert = require("assert");
var faker = require("faker");
var dockerHelpers = require("c9/docker-helpers");

describe("docker-helpers", function() {
    describe("getContainerIdFromContainer", function() {
        it("should work", function() {
            assert.equal(
                dockerHelpers.getContainerIdFromContainer('3b765c5179d1 cloud9/ws-html5:2014-11-07T10-08-51Z "/mnt/shared/sbin/mic" 3 weeks ago Up 34 hours 0.0.0.0:16276->22/tcp, 0.0.0.0:47527->8080/tcp, 0.0.0.0:46944->8081/tcp, 0.0.0.0:48538->8082/tcp container-russellfeeed-html_assesment-601963-KPRaMXXRlGruDjpH'),
                '3b765c5179d1'
            );
        });
    });

    describe("getContainerNameFromContainer", function() {
        it("should work", function() {
            assert.equal(
                dockerHelpers.getContainerNameFromContainer('3b765c5179d1 cloud9/ws-html5:2014-11-07T10-08-51Z "/mnt/shared/sbin/mic" 3 weeks ago Up 34 hours 0.0.0.0:16276->22/tcp, 0.0.0.0:47527->8080/tcp, 0.0.0.0:46944->8081/tcp, 0.0.0.0:48538->8082/tcp container-russellfeeed-html_assesment-601963-KPRaMXXRlGruDjpH'),
                'container-russellfeeed-html_assesment-601963-KPRaMXXRlGruDjpH'
            );
        });
    });
    
    describe("getUsernameFromContainerName", function () {
        it("should work", function() {
            assert.equal(dockerHelpers.getUsernameFromContainerName("container-stefko-demo-project-884917"), "stefko");
            assert.equal(dockerHelpers.getUsernameFromContainerName("container-scollins-booking_admin-1667108-yORDDrjnsOiiLveG"), "scollins");
            assert.equal(dockerHelpers.getUsernameFromContainerName("jakrawczt-test-3-jkr-1633955"), "jakrawczt");
            assert.equal(dockerHelpers.getUsernameFromContainerName("thn85-p18-1016460"), "thn85");
            assert.equal(dockerHelpers.getUsernameFromContainerName("thn85-proj-18239823-1016490"), "thn85");
            assert.equal(dockerHelpers.getUsernameFromContainerName("artawil-etutor_11plus-wp-1422098"), "artawil");
            assert.equal(dockerHelpers.getUsernameFromContainerName("container-johns66139-nice-access-bot-1753521-SDcuzVdxeUNhwhpo"), "johns66139");
            assert.equal(dockerHelpers.getUsernameFromContainerName("johns66139-nice-access-bot-1753521-SDcuzVdxeUNhwhpo"), "johns66139");
            assert.equal(dockerHelpers.getUsernameFromContainerName("yuro_yaya-nice-access-bot-1753521"), "yuro_yaya");
            assert.equal(dockerHelpers.getUsernameFromContainerName("tarunwadhwa-david--scraping-4175572"), "tarunwadhwa");
            assert.equal(dockerHelpers.getUsernameFromContainerName("d9canary"), "");
            assert.equal(dockerHelpers.getUsernameFromContainerName("selenium-9213"), "");
            assert.equal(dockerHelpers.getUsernameFromContainerName("/selenium-9213"), "");
        });
    });
    
    describe("getProjectNameFromContainerName", function() {
        it("should work", function() {
            assert.equal(dockerHelpers.getProjectNameFromContainerName("container-stefko-demo-project-884917"), "demo-project");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("container-scollins-booking_admin-1667108-yORDDrjnsOiiLveG"), "booking_admin");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("jakrawczt-test-3-jkr-1633955"), "test-3-jkr");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("thn85-p18-1016460"), "p18");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("thn85-proj-18239823-1016490"), "proj-18239823");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("artawil-etutor_11plus-wp-1422098"), "etutor_11plus-wp");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("container-johns66139-nice-access-bot-1753521-SDcuzVdxeUNhwhpo"), "nice-access-bot");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("johns66139-nice-access-bot-1753521-SDcuzVdxeUNhwhpo"), "nice-access-bot");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("container-russellfeeed-html_assesment-601963-KPRaMXXRlGruDjpH"), "html_assesment");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("tarunwadhwa-david--scraping-4175572"), "david--scraping");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("d9canary"), "");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("selenium-9213"), "");
            assert.equal(dockerHelpers.getProjectNameFromContainerName("/selenium-9213"), "");
        });
    });
    
    describe("getProjectIdFromContainerName", function() {
        it("should work", function() {
            assert.equal(dockerHelpers.getProjectIdFromContainerName("container-stefko-demo-project-884917"), "884917");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("container-scollins-booking_admin-1667108-yORDDrjnsOiiLveG"), "1667108");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("jakrawczt-test-3-jkr-1633955"), "1633955");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("jakrawczt-test-489552-1633956"), "1633956");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("/container-jan1365-ide50-2380083-XoEYNkUIDRuLqvBZ"), "2380083");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("thn85-p18-1016460"), "1016460");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("thn85-proj-18239823-1016490"), "1016490");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("artawil-etutor_11plus-wp-1422098"), "1422098");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("container-johns66139-nice-access-bot-1753521-SDcuzVdxeUNhwhpo"), "1753521");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("johns66139-nice-access-bot-1753521-SDcuzVdxeUNhwhpo"), "1753521");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("tarunwadhwa-david--scraping-4175572"), "4175572");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("d9canary"), "");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("selenium-9213"), "");
            assert.equal(dockerHelpers.getProjectIdFromContainerName("/selenium-9213"), "");
        });
    });
    
});
