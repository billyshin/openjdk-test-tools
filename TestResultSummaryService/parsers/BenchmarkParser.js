const Parser = require( './Parser' );
const BenchmarkMetricRouter = require( './BenchmarkMetricRouter' );
const BenchmarkMetric = require( './BenchmarkMetric' );

const benchmarkDelimiterRegex = /\*\*\*\*\*\*\*\*\*\* START OF NEW TESTCI BENCHMARK JOB \*\*\*\*\*\*\*\*\*\*[\r\n]/;
const benchmarkNameRegex = /Benchmark Name: (.*) Benchmark Variant: .*[\r\n]/;
const benchmarkVariantRegex = /Benchmark Name: .* Benchmark Variant: (.*)[\r\n]/;
const productResourceRegex = /Product Resource: (.*)[\r\n]/;

class BenchmarkParser extends Parser {

    // True iff all benchmarks and their corresponding iterations in the given run can be parsed
    static canParse( buildName, output ) {
        return benchmarkDelimiterRegex.test(output);
    }

    // Returns an iterator object which accesses each benchmark iteration from the given output
    static getBenchmarkIterator(output) {
        let index = 1;
        let splitOutput = output.split(benchmarkDelimiterRegex);
        let splitOutputLength = splitOutput.length;
    
        // No delimiter inside the output
        if (!(Array.isArray(splitOutput)) || splitOutputLength === 1) {
            return null;
        }
        return {
            next: function() {
                return index < splitOutputLength ?
                    {value: splitOutput[index++], done: false} :
                    {done: true};
            }
        };
    }

    parse( output ) {

        const benchmarkIterator = BenchmarkParser.getBenchmarkIterator(output);
        let curItr = benchmarkIterator.next();
        let testIndex = 1;
        let buildResult;
        const tests = [];

        while (curItr.done !== true) {

            let curBenchmarkName = null;
            let curBenchmarkVariant = null;
            let curBenchVariant = null;
            let curMetric = null;
            let curSearchString = null;
            let curRegexResult = null;
            let curMetricValues = null;
            let curProductResource = null;
            let curRegex = null;
            let isValid = true;
            let curTestData = {};

            // Parse benchmark name
            if ( ( curRegexResult = benchmarkNameRegex.exec( curItr.value ) ) !== null ) {
                curBenchmarkName = curRegexResult[1];
            } else {
                isValid = false;
            }

            // Parse benchmark variant
            if ( ( curRegexResult = benchmarkVariantRegex.exec( curItr.value ) ) !== null ) {
                curBenchmarkVariant = curRegexResult[1];
            } else {
                isValid = false;
            }

            if (!BenchmarkMetricRouter[curBenchmarkName]) {
                isValid = false;
            } else if (!BenchmarkMetricRouter[curBenchmarkName][curBenchmarkVariant]) {
                isValid = false;
            // Benchmark should have at least one metric to parse with
            } else if (!BenchmarkMetric[BenchmarkMetricRouter[curBenchmarkName][curBenchmarkVariant]]
            || !BenchmarkMetric[BenchmarkMetricRouter[curBenchmarkName][curBenchmarkVariant]]["metrics"]
            || Object.keys(BenchmarkMetric[BenchmarkMetricRouter[curBenchmarkName][curBenchmarkVariant]]["metrics"]).length === 0) {
                isValid = false;
            }
    
            if ( ( curRegexResult = productResourceRegex.exec( curItr.value ) ) !== null ) {
                curProductResource = curRegexResult[1];
            }

            if ( isValid ) {

                curBenchVariant = BenchmarkMetric[BenchmarkMetricRouter[curBenchmarkName][curBenchmarkVariant]];	
                curSearchString = curItr.value;
                
                // if outerRegex is undefined, all runs should be measured. Parse metrics in every run
                // if outerRegex is defined, any runs before outerRegex will be ignored. Parse metrics in warm runs only 
                if (curBenchVariant.outerRegex !== undefined) {
                	if ( ( curRegexResult = curBenchVariant.outerRegex.exec( curSearchString ) ) !== null ) {
                        // index 0 contains entire text (curItr.value)
                        // index 1 contains text after the outerRegex
                        curSearchString = curRegexResult[1];
                    } 
                }
                
                // Parse metric values
                curTestData["metrics"] = [];
                let curMetricList = Object.keys(curBenchVariant["metrics"]);
                for ( let i = 0; i < curMetricList.length; i++ ) {

                    curMetric = curMetricList[i];
                    curRegex = curBenchVariant["metrics"][curMetric]["regex"];  
                    /*	Parse all values for single metric from result to an array
                     *  e.g 
                     *  Liberty Startup =>
                     *  curRegexResult = ['startup time in ms 32',32,'startup time in ms 41',41, x 6] 
                     *  Liberty Throughput =>
                     *  curRegexResult = ['<metric type="throughput">32<\/data>',32]
                     */
                    curRegexResult = curSearchString.split(curRegex);
                    //collect only the capture groups from the regex array
                    curRegexResult = curRegexResult.filter( (value,index) => (index %2 === 1));
                    curMetricValues = curRegexResult.map(parseFloat);
                    /* Metrics such as JITCPU total in LibertyThroughput and geomean_GCA in CryptoBB, 
                     * require aggregate function to be applied. 
                     * e.g JIT CPU total values are collected as [ 0,0,300,200,20 ] but we display 520 as the JITCPU total  
                     */
                    if(typeof curBenchVariant["metrics"][curMetric]["funcName"] != "undefined" && curMetricValues.length != 0) {
                        curMetricValues = [curBenchVariant["metrics"][curMetric]["funcName"](curMetricValues)];
                    }
                    curTestData["metrics"].push({name: curMetric, value: curMetricValues});
                }     
            }

            tests.push( {
                testOutput: curItr.value,
                testResult: isValid ? "PASSED" : "FAILED",
                testIndex: testIndex++,
                benchmarkName: curBenchmarkName,
                benchmarkVariant: curBenchmarkVariant,
                sdkResource: curProductResource,
                testData: curTestData,                
            } );

            curItr = benchmarkIterator.next();
        }

        if ((tests.map(x=>x.testResult).indexOf("PASSED") > -1)) {
            if ((tests.map(x=>x.testResult).indexOf("FAILED") > -1)) {
                buildResult = "PARTIAL-SUCCESS";
            } else {
                buildResult = "SUCCESS";
            }
        } else {
            buildResult = "FAILURE";
        }
        const { nodeVersion, nodeRunDate} = this.exactNodeVersion( output );

        return {
            tests,
            jdkDate,
            javaVersion,
            buildResult,
            machine: this.extractMachineInfo( output ),
            type: "Perf",
            startBy: this.extractStartedBy( output ),
            artifactory: this.extractArtifact( output ),
        };
    }
}
module.exports = BenchmarkParser;
