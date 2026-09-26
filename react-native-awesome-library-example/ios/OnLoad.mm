#import <Foundation/Foundation.h>
#import "AwesomeLibraryImpl.h"
#import <ReactCommon/CxxTurboModuleUtils.h>

@interface AwesomeLibraryOnLoad : NSObject
@end

@implementation AwesomeLibraryOnLoad

using namespace facebook::react;

+ (void)load
{
  registerCxxModuleToGlobalModuleMap(
    std::string(AwesomeLibraryImpl::kModuleName),
    [](std::shared_ptr<CallInvoker> jsInvoker) {
      return std::make_shared<AwesomeLibraryImpl>(jsInvoker);
    }
  );
}

@end
