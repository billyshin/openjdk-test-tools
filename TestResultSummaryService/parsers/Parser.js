class Parser {
    constructor( buildName ) {
        this.buildName = buildName;
    }

    static canParse() { return false; }
    
    exactJavaVersion(output) {
        const javaVersionRegex = /((openjdk|java) version[\s\S]*JCL.*\n|(openjdk|java) version[\s\S]*Server VM.*\n)/;
        const javaBuildDateRegex = /-(20[0-9][0-9][0-9][0-9][0-9][0-9])/;
        let curRegexResult = null;
        let javaVersion, jdkDate;

        if ( ( curRegexResult = javaVersionRegex.exec( output ) ) !== null ) {
            javaVersion = curRegexResult[1];
        }
        curRegexResult = null;
        // parse jdk date from javaVersion
        if ( ( curRegexResult = javaBuildDateRegex.exec( javaVersion ) ) !== null ) {
            jdkDate = curRegexResult[1];
        }
        return { javaVersion, jdkDate };
    }

    exactNodeVersion(output) {
        const nodejsVersionRegex = /(Node Version[\s\S]*Rundate.*)/;
        const nodeRunDateRegex = /-(20[0-9][0-9][0-9][0-9][0-9][0-9])/;
        let curRegexResult = null;
        let nodeVersion, nodeRunDate;

        if ( ( curRegexResult = nodejsVersionRegex.exec( output ) ) !== null ) {
            nodeVersion = curRegexResult[1];
        }
        curRegexResult = null;
        // parse build run date from nodeVersion
        if ( ( curRegexResult = nodeRunDateRegex.exec( nodeVersion ) ) !== null ) {
            nodeRunDate = curRegexResult[1];
        }
        return { nodeVersion, nodeRunDate };
    }

    extractArtifact( output ) {
        let m;
        let artifact = null;
        const artifactRegex = /Deploying artifact: ?(.*?)[\r\n]/;
        if ( ( m = artifactRegex.exec( output ) ) !== null ) {
            artifact = m[1].trim();
        }
        return artifact;
    }

    extractMachineInfo( output ) {
        let m;
        let machine = null;
        const machineRegex = new RegExp( "Running on (.*?) in .*" + this.buildName );
        if ( ( m = machineRegex.exec( output ) ) !== null ) {
            machine = m[1];
        }
        return machine;
    }

    extractTestSummary( output ) {
        let m;
        let total = 0;
        let executed = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        let disabled = 0;
        const summaryRegex = /\S*\s*?TOTAL:\s*([0-9]*)\s*EXECUTED:\s*([0-9]*)\s*PASSED:\s*([0-9]*)\s*FAILED:\s*([0-9]*)\s*DISABLED:\s*([0-9]*)\s*SKIPPED:\s*([0-9]*)\s*/;
        if ( ( m = summaryRegex.exec( output ) ) !== null ) {
            total = parseInt( m[1], 10 );
            executed = parseInt( m[2], 10 );
            passed = parseInt( m[3], 10 );
            failed = parseInt( m[4], 10 );
            disabled = parseInt( m[5], 10 );
            skipped = parseInt( m[6], 10 );
        }
        return { total, executed, passed, failed, disabled, skipped };
    }

    extractStartedBy( output ) {
        let m;
        let user = null;
        const userRegex = /Started by ?(.*?)[\r\n]/;
        if ( ( m = userRegex.exec( output ) ) !== null ) {
            user = m[1];
        }
        return user;
    }

    convertBuildDateToUnixTime ( buildDate ) {
        let unixDate = null;
        const buildRegex = /(\d{4})(\d{2})(\d{2})/;
        const m = buildRegex.exec( buildDate )
        if ( m !== null ) {
            unixDate = Date.UTC(+m[1], m[2]-1, +m[3], 12);
        }
        return unixDate;
    }

    parse() { }
}

module.exports = Parser;